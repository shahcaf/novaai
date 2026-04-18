const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const Message = sequelize.define('Message', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  text: {
    type: DataTypes.TEXT,
    defaultValue: ''
  },
  mediaUrl: {
    type: DataTypes.STRING,
    defaultValue: ''
  },
  mediaType: {
    type: DataTypes.STRING,
    defaultValue: 'none',
    validate: {
      isIn: [['image', 'video', 'none']]
    }
  },
  isAI: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  timestamps: true
});

// Associations
Message.belongsTo(User, { as: 'sender', foreignKey: 'senderId' });
User.hasMany(Message, { foreignKey: 'senderId' });

module.exports = Message;
