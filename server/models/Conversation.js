const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const Conversation = sequelize.define('Conversation', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  title: {
    type: DataTypes.STRING,
    defaultValue: 'New Chat'
  },
  inviteCode: {
    type: DataTypes.STRING,
    unique: true
  }
}, {
  timestamps: true
});

// Associations
Conversation.belongsTo(User, { as: 'creator', foreignKey: 'creatorId' });
User.hasMany(Conversation, { foreignKey: 'creatorId' });

module.exports = Conversation;
