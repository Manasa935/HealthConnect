const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const app = express();

// Middleware
app.use(bodyParser.json());
app.use(express.static('public'));

// MongoDB Atlas Connection
mongoose.connect('mongodb+srv://manasabandari177:99887744@cluster0.5teec.mongodb.net/Manasa?retryWrites=true&w=majority&appName=Cluster0')
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch(err => console.error('MongoDB connection error:', err));

// User Schema
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  phone: String,
});
const User = mongoose.model('User', userSchema);

// Hospital Schema
const hospitalSchema = new mongoose.Schema({
  name: String,
  location: String,
});
const Hospital = mongoose.model('Hospital', hospitalSchema);

// Doctor Schema
const doctorSchema = new mongoose.Schema({
  name: String,
  specialty: String,
  hospitals: [String], // Changed to an array to support multiple hospitals
  slots: [{
    date: String,
    time: String,
    available: Boolean
  }],
});
const Doctor = mongoose.model('Doctor', doctorSchema);

// Appointment Schema
const appointmentSchema = new mongoose.Schema({
  userId: String,
  doctorId: String,
  slot: String,
  date: { type: Date, default: Date.now },
});
const Appointment = mongoose.model('Appointment', appointmentSchema);

// Register Route
app.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashedPassword, phone });
    await user.save();
    res.status(201).send('User registered successfully');
  } catch (error) {
    console.error('Register error:', error);
    res.status(400).send('Error registering user');
  }
});

// Login Route
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    res.json({ userId: user._id });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).send('Server error');
  }
});

// Hospitals Route with Search
app.get('/hospitals', async (req, res) => {
  try {
    const searchQuery = req.query.search || '';
    const hospitals = await Hospital.find({
      name: { $regex: searchQuery, $options: 'i' } // Case-insensitive search
    });
    res.json(hospitals);
  } catch (error) {
    console.error('Hospitals error:', error);
    res.status(500).send('Server error');
  }
});

// Doctors Route with Hospital Filter
app.get('/doctors', async (req, res) => {
  try {
    const hospitalName = req.query.hospital || '';
    let doctors;
    if (hospitalName) {
      doctors = await Doctor.find({ hospitals: hospitalName })
        .sort({ name: 1 }); // Sort alphabetically for consistency, can adjust logic for varying order
      // Modify response to exclude hospital name
      doctors = doctors.map(doctor => ({
        _id: doctor._id,
        name: doctor.name,
        specialty: doctor.specialty,
        slots: doctor.slots
      }));
    } else {
      doctors = await Doctor.find();
    }
    res.json(doctors);
  } catch (error) {
    console.error('Doctors error:', error);
    res.status(500).send('Server error');
  }
});

// Book Appointment Route
app.post('/book', async (req, res) => {
  try {
    const { userId, doctorId, date, time } = req.body;
    console.log('Booking request received:', { userId, doctorId, date, time });
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) return res.status(404).send('Doctor not found');

    const slotData = doctor.slots.find(s => s.date === date && s.time === time);
    if (!slotData || !slotData.available) {
      return res.status(400).send('Slot not available. Please choose another date or time.');
    }

    slotData.available = false;
    await doctor.save();

    const appointment = new Appointment({ userId, doctorId, slot: `${date} ${time}` });
    await appointment.save();

    const user = await User.findById(userId);
    if (!user || !user.email) {
      console.error('User or email not found for userId:', userId);
      return res.status(500).send('Server error: User email not found');
    }
    const fullSlot = `${date} ${time}`;
    console.log('Sending email to:', user.email, 'for doctor:', doctor.name, 'slot:', fullSlot);
    await sendEmail(user.email, doctor.name, fullSlot);

    res.send('Appointment booked successfully!');
  } catch (error) {
    console.error('Booking error:', error);
    res.status(500).send('Server error');
  }
});

// Nodemailer Setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'healthconnect57@gmail.com',
    pass: 'mayo hulf crnh rupk'
  },
});

async function sendEmail(to, doctorName, slot) {
  try {
    const mailOptions = {
      from: 'healthconnectinghub@gmail.com',
      to: to,
      subject: 'Appointment Confirmation - Health Connect',
      text: `Thank you for choosing Health Connect Appointment Hub for your healthcare needs.
            We are happy to confirm your appointment with Dr.${doctorName} at ${slot} has been successfully booked!
            Please arrive a few minutes early to complete any necessary paperwork.
            If you have any questions or need to change your appointment, don’t hesitate to contact us or simply reply to this email.

            We look forward to seeing you soon and helping you with your health needs!`,
    };
    console.log('Attempting to send email to:', to);
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent to:', to, 'Message ID:', info.messageId);
  } catch (error) {
    console.error('Email error:', error.message, 'Code:', error.code);
    throw error;
  }
}

// Seed Data (Updated)
const seedHospitals = async () => {
  await Hospital.deleteMany({}); // Clear existing data
  await Hospital.insertMany([
    { name: 'City Hospital', location: 'Downtown' },
    { name: 'One care Hospital', location: 'North Side' },
    { name: 'HealthCare Hospital', location: 'South Side' },
    { name: 'Community Hospital', location: 'East Side' },
    { name: 'Specialty Care Hospital', location: 'West Side' },
    { name: 'Gandhi Hospital', location: 'Secunderabad' },
    { name: 'Rainbow Hospital', location: 'West Side, HYD' },
    { name: 'NIMS Hospital', location: 'Old Town, HYD' },
    { name: 'KIMS Hospital', location: 'Begumpet, HYD' },
    { name: 'Apollo Hospital', location: 'Film Nagar, HYD' },
    { name: 'Sun Shine Hospital', location: 'East Side, HYD' },
  ]);
  console.log('Hospitals seeded');
};

const seedDoctors = async () => {
  await Doctor.deleteMany({}); // Clear existing data
  await Doctor.insertMany([
    { 
      name: 'Dr. Anil Reddy', 
      specialty: 'Orthopedics', 
      hospitals: ['Apollo Hospital'], 
      slots: [
        { date: '2025-05-27', time: '09:00-10:00', available: true },
        { date: '2025-06-30', time: '10:00-11:00', available: true },
      ]
    },
    { 
      name: 'Dr. Prathap Varma', 
      specialty: 'Determatologist', 
      hospitals: ['City Hospital'], 
      slots: [
        { date: '2025-05-11', time: '09:00-10:00', available: true },
        { date: '2025-06-13', time: '10:00-11:00', available: true },
      ]
    },
    { 
      name: 'Dr. Navya Sri', 
      specialty: 'Radiologist', 
      hospitals: ['One care Hospital'], 
      slots: [
        { date: '2025-05-27', time: '09:00-10:00', available: true },
        { date: '2025-06-26', time: '10:00-11:00', available: true },
      ]
    },
    { 
      name: 'Dr. Usha Rani', 
      specialty: 'Orthopedics', 
      hospitals: ['Community Hospital'], 
      slots: [
        { date: '2025-05-12', time: '09:00-10:00', available: true },
        { date: '2025-06-20', time: '10:00-11:00', available: true },
      ]
    },
    { 
      name: 'Dr. Sarala Reddy', 
      specialty: 'pathalogist', 
      hospitals: ['Specialty Care Hoapital'], 
      slots: [
        { date: '2025-05-27', time: '09:00-10:00', available: true },
        { date: '2025-06-30', time: '10:00-11:00', available: true },
      ]
    },
    { 
      name: 'Dr. Priya Sharma', 
      specialty: 'Pediatrics', 
      hospitals: ['Rainbow Hospital', 'Sun Shine Hospital', 'City Hospital', 'One care Hospital', 'Gandhi Hospital', 'NIMS Hospital', 'Apollo Hospital'], 
      slots: [
        { date: '2025-05-28', time: '11:00-12:00', available: true },
        { date: '2025-06-07', time: '16:00-17:00', available: true },
      ]
    },
    { 
      name: 'Dr. Sanjay Patel', 
      specialty: 'Cardiology', 
      hospitals: ['City Hospital', 'HealthCare Hospital', 'Specialty Care Hospital', 'Rainbow Hospital', 'KIMS Hospital', 'Sun Shine Hospital'], 
      slots: [
        { date: '2025-05-12', time: '10:30-11:30', available: true },
        { date: '2025-05-14', time: '15:00-16:00', available: true },
      ]
    },
    { 
      name: 'Dr. John Smith', 
      specialty: 'Cardiology', 
      hospitals: ['City Hospital','One care Hospital', 'Community Hospital', 'Gandhi Hospital', 'NIMS Hospital', 'Apollo Hospital'], 
      slots: [
        { date: '2025-05-10', time: '10:00-11:00', available: true },
        { date: '2025-05-11', time: '11:00-12:00', available: true },
      ]
    },
    { 
      name: 'Dr. Emily Brown', 
      specialty: 'General Physician', 
      hospitals: ['One care Hospital', 'Apollo Hospital', 'NIMS Hospital','Rainbow Hospital', 'Sun Shine Hospital', 'Gandhi Hospital', 'Specialty Care Hospital'], 
      slots: [
        { date: '2025-05-27', time: '09:00-10:00', available: true },
        { date: '2025-05-27', time: '14:00-15:00', available: true },
      ]
    },
    { 
      name: 'Dr. Ravi Kumar', 
      specialty: 'Neurology', 
      hospitals: ['NIMS Hospital', 'City Hospital', 'One care Hospital', 'Rainbow Hospital', 'Community Hospital'], 
      slots: [
        { date: '2025-05-27', time: '10:30-11:30', available: true },
        { date: '2025-05-27', time: '15:00-16:00', available: true },
      ]
    },
    { 
      name: 'Dr. Anusha Yadav', 
      specialty: 'Neurology', 
      hospitals: ['Gandhi Hospital', 'HealthCare Hospital', 'City Hospital', 'One Care Hospital','Community Hospital', 'Sun Shine Hospital'], 
      slots: [
        { date: '2025-05-27', time: '10:30-11:30', available: true },
        { date: '2025-05-27', time: '15:00-16:00', available: true },
      ]
    },
    { 
      name: 'Dr. Sandeep Kumar', 
      specialty: 'Dermatologist', 
      hospitals: ['Rainbow Hospital', 'Community Hospital', 'City Hospital', 'Gandhi Hospital', 'Sun Shine Hospital', 'Apollo Hospital'], 
      slots: [
        { date: '2025-05-27', time: '10:30-11:30', available: true },
        { date: '2025-05-27', time: '15:00-16:00', available: true },
      ]
    },
    { 
      name: 'Dr. Vikram Karla', 
      specialty: 'Radiologist', 
      hospitals: ['Specialty Care Hospital', 'NIMS Hospital'], 
      slots: [
        { date: '2025-05-20', time: '10:30-11:30', available: true },
        { date: '2025-05-17', time: '15:00-16:00', available: true },
      ]
    },
    { 
      name: 'Dr. Yamuna Joshi', 
      specialty: 'pathologist', 
      hospitals: ['KIMS Hospital', 'Apollo Hospital'], 
      slots: [
        { date: '2025-05-15', time: '10:30-11:30', available: true },
        { date: '2025-05-19', time: '15:00-16:00', available: true },
      ]
    },
    { 
      name: 'Dr. Rakesh Rathod', 
      specialty: 'Anesthesiologist', 
      hospitals: ['Sun Shine Hospital'], 
      slots: [
        { date: '2025-05-19', time: '10:30-11:30', available: true },
        { date: '2025-06-18', time: '15:00-16:00', available: true },
      ]
    },
    { 
      name: 'Dr. Santhosh Kumar', 
      specialty: 'Neurologist', 
      hospitals: ['Apollo Hospital','City Hospital', 'HealthCare Hospital', 'Community Hospital', 'Speciality Care Hospital'], 
      slots: [
        { date: '2025-05-18', time: '10:30-11:30', available: true },
        { date: '2025-05-10', time: '15:00-16:00', available: true },
      ]
    },
    { 
      name: 'Dr. Ashok ', 
      specialty: 'Cardiology', 
      hospitals: ['Community Hospital', 'City Hospital', 'HealthCare Hospital', 'Community Hospital', 'Speciality Care Hospital'], 
      slots: [
        { date: '2025-05-22', time: '10:30-11:30', available: true },
        { date: '2025-05-09', time: '15:00-16:00', available: true },
      ]
    },
    { 
      name: 'Dr. Saritha Reddy', 
      specialty: 'Dermatologist', 
      hospitals: ['HealthCare Hospital', 'City Hospital', 'HealthCare Hospital', 'Community Hospital', 'Speciality Care Hospital' ],
      slots: [
        { date: '2025-05-27', time: '10:30-11:30', available: true },
        { date: '2025-05-27', time: '15:00-16:00', available: true },
      ]
    },
  ]);
  console.log('Doctors seeded');
};

// Seed the data
seedHospitals();
seedDoctors();

// Start Server
app.listen(3000, () => console.log('Server running on http://localhost:3000'));