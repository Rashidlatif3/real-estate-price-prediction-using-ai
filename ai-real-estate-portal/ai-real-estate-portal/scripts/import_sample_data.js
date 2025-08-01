const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Property = require(path.resolve(__dirname, '../models/Property'));

mongoose.connect('mongodb://localhost:27017/ai-real-estate-portal', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(async () => {
    console.log('Connected to MongoDB');

    try {
        const dataPath = path.join(__dirname, '../sample_properties.json');
        const jsonData = fs.readFileSync(dataPath, 'utf-8');
        const properties = JSON.parse(jsonData);

        await Property.deleteMany({});
        await Property.insertMany(properties);

        console.log('Sample properties imported successfully');
    } catch (err) {
        console.error('Error importing sample properties:', err);
    } finally {
        mongoose.disconnect();
    }
}).catch(err => {
    console.error('MongoDB connection error:', err);
});
