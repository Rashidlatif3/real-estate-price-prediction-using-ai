document.addEventListener('DOMContentLoaded', () => {
    const predictBtn = document.getElementById('predict-price-btn');
    const locationInput = document.getElementById('location');
    const sizeInput = document.getElementById('size');
    const roomsInput = document.getElementById('rooms');
    const predictedPriceDisplay = document.getElementById('predicted-price');

    predictBtn.addEventListener('click', async () => {
        const location = locationInput.value.trim();
        const size = Number(sizeInput.value);
        const rooms = Number(roomsInput.value);

        if (!location || !size || !rooms) {
            predictedPriceDisplay.textContent = 'Please enter location, size, and number of rooms.';
            return;
        }

        try {
            // Use absolute URL to backend server to avoid relative path issues
            const response = await fetch('http://localhost:3003/predict-price', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ location, size, rooms })
            });

            const data = await response.json();
            if (data.predictedPrice) {
                predictedPriceDisplay.textContent = `Predicted Price: PKR ${data.predictedPrice.toLocaleString()}`;
            } else if (data.error) {
                predictedPriceDisplay.textContent = `Error: ${data.error}`;
            } else {
                predictedPriceDisplay.textContent = 'Prediction failed.';
            }
        } catch (error) {
            predictedPriceDisplay.textContent = 'Error connecting to prediction service.';
        }
    });
});
