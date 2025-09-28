const { Sequelize } = require('sequelize');
const path = require('path');

const DATABASE_PATH = process.env.DATABASE_PATH || './database.sqlite';

if (!DATABASE_PATH) {
  throw new Error('Please define the DATABASE_PATH environment variable inside .env');
}

let sequelize;

function getSequelizeInstance() {
  if (!sequelize) {
    sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: path.resolve(DATABASE_PATH),
      logging: process.env.NODE_ENV === 'development' ? console.log : false,
      define: {
        timestamps: true,
        underscored: false,
      },
    });
  }
  return sequelize;
}

async function connectToDatabase() {
  try {
    const sequelizeInstance = getSequelizeInstance();
    await sequelizeInstance.authenticate();
    console.log('✅ Connected to SQLite database successfully');
    
    // Sync all models
    await sequelizeInstance.sync({ alter: true });
    console.log('✅ Database models synchronized');
    
    return sequelizeInstance;
  } catch (error) {
    console.error('❌ Unable to connect to SQLite database:', error);
    throw error;
  }
}

module.exports = { connectToDatabase, getSequelizeInstance };