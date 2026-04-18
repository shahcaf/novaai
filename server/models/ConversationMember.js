const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');
const Conversation = require('./Conversation');

const ConversationMember = sequelize.define('ConversationMember', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    references: { model: User, key: 'id' }
  },
  conversationId: {
    type: DataTypes.UUID,
    references: { model: Conversation, key: 'id' }
  },
  role: {
    type: DataTypes.ENUM('owner', 'admin', 'member'),
    defaultValue: 'member'
  }
}, {
  timestamps: true
});

// Associations
User.belongsToMany(Conversation, { through: ConversationMember, foreignKey: 'userId' });
Conversation.belongsToMany(User, { through: ConversationMember, foreignKey: 'conversationId' });
ConversationMember.belongsTo(User, { foreignKey: 'userId' });

module.exports = ConversationMember;
