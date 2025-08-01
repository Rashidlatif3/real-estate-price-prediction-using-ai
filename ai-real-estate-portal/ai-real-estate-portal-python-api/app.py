from flask import Flask, request, jsonify
import joblib
import pandas as pd

app = Flask(__name__)

# Load the trained model and model columns
model = joblib.load('model.pkl')
model_columns = joblib.load('model_columns.pkl')

@app.route('/')
def home():
    return "Welcome to the AI Real Estate Price Prediction API"

@app.route('/predict', methods=['POST'])
def predict():
    data = request.json
    try:
        # Prepare input data with all model columns
        input_data = {col: 0 for col in model_columns}
        # Set size and rooms
        input_data['size'] = data.get('size', 0)
        input_data['rooms'] = data.get('rooms', 0)
        # Handle location one-hot encoding
        location_col = 'location_' + data.get('location', '')
        if location_col in input_data:
            input_data[location_col] = 1
        df = pd.DataFrame([input_data])
        prediction = model.predict(df)[0]
        return jsonify({'predicted_price': prediction})
    except Exception as e:
        return jsonify({'error': str(e)}), 400
        
if __name__ == '__main__':
    app.run(port=5000, debug=True)
