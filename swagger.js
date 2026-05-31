import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Meridian CRM API',
      version: '1.0.0',
      description: 'Full API documentation for the Meridian CRM backend. Authenticate via POST /api/login, then use the Authorize button with your JWT token.',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Local development server',
      },
    ],
    tags: [
      { name: 'Auth', description: 'Login and logout' },
      { name: 'Users', description: 'Current user profile and account settings' },
      { name: 'Dashboard', description: 'Dashboard statistics and charts data' },
      { name: 'Leads', description: 'Lead management CRUD' },
      { name: 'Reports', description: 'Sales and user reports' },
      { name: 'Messages', description: 'User-to-user chat and notifications' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
        Message: {
          type: 'object',
          properties: {
            message: { type: 'string' },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string' },
            email: { type: 'string' },
            phone: { type: 'string' },
            role: { type: 'string', enum: ['User', 'Manager', 'Admin'] },
            avatar: { type: 'string' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        Lead: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            status: { type: 'string', enum: ['New', 'Contacted', 'Qualified', 'Closed', 'Lost'] },
            value: { type: 'number' },
            source: { type: 'string' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        LeadInput: {
          type: 'object',
          required: ['status', 'value', 'source'],
          properties: {
            status: { type: 'string', example: 'New' },
            value: { type: 'number', example: 1500 },
            source: { type: 'string', example: 'Website' },
          },
        },
        ChatMessage: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            body: { type: 'string' },
            sender_id: { type: 'integer' },
            sender_name: { type: 'string' },
            sender_avatar: { type: 'string' },
            is_read: { type: 'boolean' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        SendMessageInput: {
          type: 'object',
          required: ['body'],
          properties: {
            body: { type: 'string', example: 'Hello!' },
          },
        },
        PasswordChangeInput: {
          type: 'object',
          required: ['currentPassword', 'newPassword'],
          properties: {
            currentPassword: { type: 'string' },
            newPassword: { type: 'string', minLength: 6 },
          },
        },
        ProfileUpdateInput: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            phone: { type: 'string' },
          },
        },
      },
    },
  },
  apis: ['./routes/*.js', './server.js'],
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
