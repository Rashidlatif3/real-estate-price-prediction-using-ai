import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import train_test_split
import joblib

# Load dataset
df = pd.read_csv('data.csv')

# One-hot encode location
df = pd.get_dummies(df, columns=['location'], drop_first=True)

# Features and target
X = df.drop('price', axis=1)
y = df['price']

# Train/test split
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# Train linear regression model
model = LinearRegression()
model.fit(X_train, y_train)

# Save the trained model and columns used for encoding
joblib.dump(model, 'model.pkl')
joblib.dump(X.columns.tolist(), 'model_columns.pkl')

print("Model trained and saved as model.pkl and model_columns.pkl")
