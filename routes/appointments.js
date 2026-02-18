const express = require('express');
const router = express.Router();

router.get('/test-appointments', (req, res) => {
    res.json({ message: 'Appointments route placeholder' });
});

module.exports = router;
