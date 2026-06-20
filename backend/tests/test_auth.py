# backend/tests/test_auth.py
import unittest
from datetime import timedelta
from flask_jwt_extended import decode_token
from app import create_app
from app.models import db, User
from app.services.auth_service import token_blocklist

class TestAuthEndpoints(unittest.TestCase):
    def setUp(self):
        # Create Flask application configured for testing
        self.app = create_app()
        self.app.config['TESTING'] = True
        self.app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
        self.app.config['JWT_SECRET_KEY'] = 'test-jwt-secret-key-for-testing'
        self.client = self.app.test_client()
        
        # Clear the blocklist before each test run
        token_blocklist.clear()

        # Push application context and initialize in-memory database
        self.ctx = self.app.app_context()
        self.ctx.push()
        db.create_all()

    def tearDown(self):
        # Clean up database and pop application context
        db.session.remove()
        db.drop_all()
        self.ctx.pop()

    def test_register_success(self):
        # Test successful user registration
        payload = {
            "Fullname": "Test User",
            "email": "test@example.com",
            "password": "securepassword123"
        }
        response = self.client.post('/api/auth/register', json=payload)
        self.assertEqual(response.status_code, 201)
        
        data = response.get_json()
        self.assertIn("message", data)
        self.assertEqual(data["user"]["Fullname"], "Test User")
        self.assertEqual(data["user"]["email"], "test@example.com")
        self.assertEqual(data["user"]["role"], "citizen")  # Default role must be citizen

        # Verify user is actually saved in database
        user = User.query.filter_by(email="test@example.com").first()
        self.assertIsNotNone(user)
        self.assertEqual(user.Fullname, "Test User")
        self.assertEqual(user.role, "citizen")

    def test_register_missing_fields(self):
        # Test validation error 400 when registration fields are missing
        payload = {
            "Fullname": "Test User",
            "email": "test@example.com"
            # password missing
        }
        response = self.client.post('/api/auth/register', json=payload)
        self.assertEqual(response.status_code, 400)
        self.assertIn("error", response.get_json())

    def test_register_duplicate_email(self):
        # Register initial user
        payload1 = {
            "Fullname": "User One",
            "email": "test@example.com",
            "password": "password123"
        }
        self.client.post('/api/auth/register', json=payload1)

        # Register second user with duplicate email
        payload2 = {
            "Fullname": "User Two",
            "email": "test@example.com",
            "password": "password456"
        }
        response = self.client.post('/api/auth/register', json=payload2)
        self.assertEqual(response.status_code, 409)
        self.assertIn("error", response.get_json())

    def test_register_duplicate_fullname(self):
        # Register initial user
        payload1 = {
            "Fullname": "Duplicate Name",
            "email": "test1@example.com",
            "password": "password123"
        }
        self.client.post('/api/auth/register', json=payload1)

        # Register second user with duplicate fullname
        payload2 = {
            "Fullname": "Duplicate Name",
            "email": "test2@example.com",
            "password": "password456"
        }
        response = self.client.post('/api/auth/register', json=payload2)
        self.assertEqual(response.status_code, 409)
        self.assertIn("error", response.get_json())

    def test_login_success_no_remember_me(self):
        # Register user
        reg_payload = {
            "Fullname": "Login User",
            "email": "login@example.com",
            "password": "password123"
        }
        self.client.post('/api/auth/register', json=reg_payload)

        # Login
        login_payload = {
            "email": "login@example.com",
            "password": "password123",
            "remember_me": False
        }
        response = self.client.post('/api/auth/login', json=login_payload)
        self.assertEqual(response.status_code, 200)

        data = response.get_json()
        self.assertIn("access_token", data)
        self.assertIn("refresh_token", data)
        self.assertEqual(data["user"]["email"], "login@example.com")
        self.assertEqual(data["user"]["role"], "citizen")

        # Decode tokens to verify identity claims
        access_decoded = decode_token(data["access_token"])
        refresh_decoded = decode_token(data["refresh_token"])

        # Embeds user ID and role in token claims
        self.assertEqual(access_decoded["role"], "citizen")
        self.assertEqual(refresh_decoded["role"], "citizen")
        self.assertEqual(access_decoded["sub"], data["user"]["id"])
        self.assertEqual(refresh_decoded["sub"], data["user"]["id"])
        
        # Verify default lifespans (remember_me=False: access ~ 15m, refresh ~ 1d)
        refresh_duration = refresh_decoded["exp"] - refresh_decoded["iat"]
        # Allow slight offset (e.g. 1-2 seconds) during execution time
        self.assertTrue(abs(refresh_duration - timedelta(days=1).total_seconds()) < 5)

    def test_login_success_remember_me(self):
        # Register user
        reg_payload = {
            "Fullname": "Remember User",
            "email": "remember@example.com",
            "password": "password123"
        }
        self.client.post('/api/auth/register', json=reg_payload)

        # Login with remember_me=True
        login_payload = {
            "email": "remember@example.com",
            "password": "password123",
            "remember_me": True
        }
        response = self.client.post('/api/auth/login', json=login_payload)
        self.assertEqual(response.status_code, 200)

        data = response.get_json()
        self.assertIn("access_token", data)
        self.assertIn("refresh_token", data)

        # Verify extended refresh token lifespan (~ 30 days)
        refresh_decoded = decode_token(data["refresh_token"])
        refresh_duration = refresh_decoded["exp"] - refresh_decoded["iat"]
        self.assertTrue(abs(refresh_duration - timedelta(days=30).total_seconds()) < 5)

    def test_login_invalid_credentials(self):
        # Login with non-existent user
        payload = {
            "email": "nonexistent@example.com",
            "password": "wrongpassword"
        }
        response = self.client.post('/api/auth/login', json=payload)
        self.assertEqual(response.status_code, 401)
        self.assertIn("error", response.get_json())

    def test_token_rotation_refresh(self):
        # Register and Login to get refresh token
        reg_payload = {
            "Fullname": "Rotate User",
            "email": "rotate@example.com",
            "password": "password123"
        }
        self.client.post('/api/auth/register', json=reg_payload)

        login_payload = {
            "email": "rotate@example.com",
            "password": "password123"
        }
        login_resp = self.client.post('/api/auth/login', json=login_payload)
        refresh_token = login_resp.get_json()["refresh_token"]

        # Call /refresh with the refresh token
        headers = {"Authorization": f"Bearer {refresh_token}"}
        refresh_resp = self.client.post('/api/auth/refresh', headers=headers)
        self.assertEqual(refresh_resp.status_code, 200)

        new_tokens = refresh_resp.get_json()
        self.assertIn("access_token", new_tokens)
        self.assertIn("refresh_token", new_tokens)

        # Ensure the old refresh token is rotated (blacklisted) and cannot be reused
        retry_resp = self.client.post('/api/auth/refresh', headers=headers)
        self.assertEqual(retry_resp.status_code, 401)  # Flask-JWT-Extended blocklist triggers 401

    def test_logout_revokes_token(self):
        # Register and Login to get access token
        reg_payload = {
            "Fullname": "Logout User",
            "email": "logout@example.com",
            "password": "password123"
        }
        self.client.post('/api/auth/register', json=reg_payload)

        login_payload = {
            "email": "logout@example.com",
            "password": "password123"
        }
        login_resp = self.client.post('/api/auth/login', json=login_payload)
        access_token = login_resp.get_json()["access_token"]

        headers = {"Authorization": f"Bearer {access_token}"}
        
        # Access a hypothetical protected resource or logout
        logout_resp = self.client.post('/api/auth/logout', headers=headers)
        self.assertEqual(logout_resp.status_code, 200)
        self.assertEqual(logout_resp.get_json()["message"], "Successfully logged out.")

        # Re-requesting logout or using the token again should fail
        retry_resp = self.client.post('/api/auth/logout', headers=headers)
        self.assertEqual(retry_resp.status_code, 401)  # Token is now blocklisted

if __name__ == "__main__":
    unittest.main()
