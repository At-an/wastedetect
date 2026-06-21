# backend/app/services/yolo_service.py
import os
import yaml
import numpy as np
import openvino as ov
from PIL import Image
import io

class YoloService:
    def __init__(self):
        # 1. Step up two directories from backend/app/services/ to reach backend/
        current_dir = os.path.dirname(os.path.abspath(__file__))
        backend_root = os.path.normpath(os.path.join(current_dir, '..', '..'))
        
        # 2. Target the sibling ml_model directory perfectly
        self.model_path = os.path.join(backend_root, 'ml_model', 'best.xml')
        self.metadata_path = os.path.join(backend_root, 'ml_model', 'metadata.yaml')
        
        self.class_names = {}
        if os.path.exists(self.metadata_path):
            try:
                with open(self.metadata_path, 'r') as f:
                    meta_data = yaml.safe_load(f)
                    if 'names' in meta_data:
                        self.class_names = {int(k): v for k, v in meta_data['names'].items()}
            except Exception as e:
                print(f"[Warning] Failed to safely parse yaml mapping categories: {e}")

        print(f"Mounting production OpenVINO core engine from: {self.model_path}")
        self.core = ov.Core()
        self.model_structure = self.core.read_model(model=self.model_path)
        self.compiled_model = self.core.compile_model(self.model_structure, "CPU")
        
        self.input_layer = self.compiled_model.input(0)
        self.output_layer = self.compiled_model.output(0)

    def pre_process_image(self, image_bytes):
        image = Image.open(io.BytesIO(image_bytes)).convert('RGB')
        original_width, original_height = image.size
        image_resized = image.resize((640, 640))
        img_array = np.array(image_resized).astype(np.float32)
        img_array /= 255.0
        img_array = img_array.transpose(2, 0, 1)
        input_tensor = np.expand_dims(img_array, axis=0)
        return input_tensor, original_width, original_height

    def run_inference(self, image_bytes):
        input_tensor, orig_w, orig_h = self.pre_process_image(image_bytes)
        infer_result = self.compiled_model([input_tensor])[self.output_layer]
        output = infer_result[0] 
        
        boxes = output[:4, :]
        scores = output[4:, :]
        
        class_ids = np.argmax(scores, axis=0)
        confidences = np.max(scores, axis=0)
        
        best_match_idx = np.argmax(confidences)
        max_conf = confidences[best_match_idx]
        
        if max_conf < 0.5:
            return {
                "predicted_category": "Unclassified Material",
                "confidence": float(max_conf),
                "tip": "This item could not be confidently identified by the system. Please ensure adequate lighting and center the object clearly in the scanner crosshairs.",
                "monthly_impact_message": "Every verification attempt helps keep the community clean. Thank you for your conscious sorting efforts!"
            }
            
        detected_class_id = class_ids[best_match_idx]
        raw_object_name = self.class_names.get(detected_class_id, f"Object-ID-{detected_class_id}").lower()
        
        return self.map_object_to_waste_profile(raw_object_name, float(max_conf))

    def map_object_to_waste_profile(self, object_name, confidence):
        """
        Maps detected waste objects into 5 explicit local categories.
        Replaces Western color-coded bin colors with realistic localized placeholders.
        """
        # Broadly categorized keyword lists matching the 5 exact model classes for more user-friendly feedback
        recyclable_plastics = ['bottle', 'plastic', 'pet', 'container', 'sachet', 'plastic cup', 'wrapper', 'nylon']
        recyclable_papers = ['cardboard', 'paper', 'box', 'carton', 'newspaper', 'magazine', 'envelope', 'book']
        recyclable_metals = ['can', 'aluminum', 'tin', 'steel', 'foil', 'iron', 'scrap', 'copper wire', 'rod']
        recyclable_glasses = ['glass', 'jar', 'bottle', 'cup', 'windowpane', 'mirror', 'ceramic', 'flask', 'shard']
        organic_wastes = ['food', 'banana', 'peel', 'waste', 'organic', 'fruit', 'vegetable', 'plant', 'leef', 'chaff']
        
        # Standardize string inputs to avoid letter casing mismatch errors
        object_name = object_name.strip().lower()

        if any(keyword in object_name for keyword in recyclable_plastics):
            category = "Recyclable Plastic"
            tip = f"Identified a '{object_name}'. This item can be cleanly processed. Please rinse out any remaining liquid residues or food traces, then place it inside your dedicated {category} bin."
            impact = "Your proactive recycling action prevents plastic pollution and helps protect local waterways in our community!"
        elif any(keyword in object_name for keyword in recyclable_papers):
            category = "Recyclable Paper/Cardboard"
            tip = f"Identified a '{object_name}'. Please flatten this material to conserve collection bin volume and keep it completely dry inside your dedicated {category} bin."
            impact = "By recycling this paper item, you help conserve natural resources and lower carbon footprints."
        elif any(keyword in object_name for keyword in recyclable_metals):
            category = "Recyclable Metal"
            tip = f"Identified a '{object_name}'. Rinse out food residues if present, and secure sharp edges before dropping it into your dedicated {category} bin."
            impact = "Recycling metals saves significant mineral resources and reduces the need for environmentally damaging mining activities."
        elif any(keyword in object_name for keyword in recyclable_glasses):
            category = "Recyclable Glass/Ceramics"
            tip = f"Identified a '{object_name}'. Please ensure this item is free of food or liquid residues and place it inside your dedicated {category} bin for proper processing."
            impact = "Recycling glass and ceramics reduces landfill waste, drastically limits collection injuries and supports straightforward material reuse in new products."
        elif any(keyword in object_name for keyword in organic_wastes):
            category = "Organic Composting"
            tip = f"Identified organic '{object_name}'. Keep this separate from manufactured materials. Place it inide your dedicated {category} bin for direct composting options."
            impact = "Separating food organic waste from landfills reduces methane emissions significantly and yields fertilizers for local agriculture, promoting a circular economy."
        else:
            category = "General Waste"
            tip = f"Identified a '{object_name}'. This item cannot be cleanly categorized right now. Please dispose of it safely in a standard refuse bin for organized collection."
            impact = "Containing mixed scraps securely limits local open littering and maintains a cleaner environment for the community. Thank you for your responsible disposal efforts!"

        return {
            "predicted_category": category,
            "confidence": round(confidence * 100, 1),
            "tip": tip,
            "monthly_impact_message": impact
        }

yolo_service = YoloService()