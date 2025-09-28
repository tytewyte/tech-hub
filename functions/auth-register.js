const connectToDatabase = require('../../utils/db');
const User = require('../../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.handler = async (event, context) => {
  // Handle CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ message: 'Method not allowed' })
    };
  }

  console.log('Register function invoked.');
  try {
    console.log('Connecting to database...');
    if (!process.env.MONGODB_URI) {
      console.error('MONGODB_URI not set.');
      throw new Error('Database URI is not configured.');
    }
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET not set.');
      throw new Error('JWT secret is not configured.');
    }

    await connectToDatabase();
    console.log('Database connection successful.');

    const { username, email, password } = JSON.parse(event.body || '{}');

    if (!username || !email || !password) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: 'Missing required fields' })
      };
    }

    // Check if user already exists
    console.log(`Checking for existing user with email: ${email}`);
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: 'User already exists' })
      };
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    console.log('Creating new user...');
    const user = new User({
      username,
      email,
      password: hashedPassword
    });

    await user.save();
    console.log(`User ${username} saved successfully.`);

    // Generate JWT
    const payload = { userId: user.id };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        token,
        user: { id: user.id, username: user.username, email: user.email }
      })
    };
  } catch (error) {
    console.error('[REGISTRATION_ERROR]', error);
    // Do not expose detailed error messages to the client
    const errorMessage = error.message.includes('configured') 
      ? 'Server configuration error.' 
      : 'Server error during registration.';
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: 'Server error during registration' })
    };
  }
};
