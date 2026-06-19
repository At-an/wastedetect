import os
import sys

def test_load_model():
    # Resolve the path to backend/ml_model/best.xml relative to this file
    current_dir = os.path.dirname(os.path.abspath(__file__))
    model_path = os.path.normpath(os.path.join(current_dir, '..', 'ml_model', 'best.xml'))
    
    print(f"Attempting to load OpenVINO model from: {model_path}")
    
    if not os.path.exists(model_path):
        print(f"Error: Model file not found at {model_path}")
        sys.exit(1)
        
    try:
        # Import YOLO inside the try block to catch environment/DLL errors
        print("Importing Ultralytics YOLO (this may load PyTorch dependencies)...")
        from ultralytics import YOLO
        
        # Load the OpenVINO model using Ultralytics YOLO
        model = YOLO(model_path)
        print("Success: Model initialized correctly using Ultralytics YOLO!")
        print(f"Model type: {type(model)}")
    except (ImportError, OSError) as e:
        print(f"\n[Warning] Failed to initialize using Ultralytics YOLO. Error: {e}")
        print("Note: This is commonly caused by PyTorch dependency/DLL compatibility issues on Windows (e.g., c10.dll) in newer Python versions (like 3.14).")
        print("\n--- Fallback Verification: Testing Native OpenVINO Loading ---")
        try:
            print("Importing openvino...")
            import openvino as ov
            
            print("Initializing OpenVINO Core...")
            core = ov.Core()
            
            print("Reading OpenVINO model xml...")
            model = core.read_model(model=model_path)
            
            print("Compiling OpenVINO model on CPU...")
            compiled_model = core.compile_model(model, "CPU")
            
            print("Success: The OpenVINO model file is valid and initializes correctly using the native OpenVINO Core API!")
        except Exception as fallback_err:
            print(f"Failure: Native OpenVINO load also failed. Error: {fallback_err}")
            sys.exit(1)
    except Exception as e:
        print(f"Failure: Failed to initialize the model. Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    test_load_model()
