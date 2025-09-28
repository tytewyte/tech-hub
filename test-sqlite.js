require('dotenv').config();
const { connectToDatabase } = require('./utils/db');
const User = require('./models/User');
const Manual = require('./models/Manual');

async function testSQLiteConnection() {
  try {
    console.log('🔍 Testing SQLite database connection...');
    
    // Connect to database
    const sequelize = await connectToDatabase();
    console.log('✅ Database connection successful!');
    
    // Test creating a user
    const testUser = await User.create({
      username: 'testuser',
      email: 'test@example.com',
      password: 'hashedpassword123'
    });
    console.log('✅ Test user created:', testUser.username);
    
    // Test querying users
    const users = await User.findAll();
    console.log(`✅ Found ${users.length} users in database`);
    
    // Clean up test data
    await User.destroy({ where: { username: 'testuser' } });
    console.log('✅ Test data cleaned up');
    
    console.log('🎉 SQLite setup is working perfectly!');
    
  } catch (error) {
    console.error('❌ SQLite test failed:', error.message);
  } finally {
    process.exit(0);
  }
}

testSQLiteConnection();