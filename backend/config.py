# If you configure them directly within your Flask config structures or a .env file:
import os
import cloudinary

class Config:
    # Your existing JWT and SQL configurations...
    
    # Cloudinary integration initialization parameters
    CLOUDINARY_URL = os.environ.get(
        'CLOUDINARY_URL', 
        'cloudinary://125883987548358:sLfLybx1lCedv8rFDNcL6YrKQYY@dppklhn89'
    )