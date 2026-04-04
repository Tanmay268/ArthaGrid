const swaggerJsdoc = require('swagger-jsdoc');
const baseUrl = process.env.APP_BASE_URL || process.env.RENDER_EXTERNAL_URL;
const servers = [
  { url: 'http://localhost:5000/api/v1', description: 'Local development' },
];

if (baseUrl) {
  servers.unshift({ url: `${baseUrl}/api/v1`, description: 'Deployed environment' });
}

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Finance Dashboard API',
      version: '1.0.0',
      description: `
## Finance Dashboard Backend API

A role-based access control (RBAC) backend for managing financial records and dashboard analytics.

### Roles & Permissions

| Permission            | Viewer | Analyst | Admin |
|-----------------------|--------|---------|-------|
| Read transactions     | ✓      | ✓       | ✓     |
| Write transactions    |        |         | ✓     |
| Delete transactions   |        |         | ✓     |
| Read dashboard        | ✓      | ✓       | ✓     |
| Read analytics        |        | ✓       | ✓     |
| Manage users          |        |         | ✓     |
| Read audit log        |        |         | ✓     |

### Authentication
All protected endpoints require a Bearer JWT token:
\`\`\`
Authorization: Bearer <token>
\`\`\`

Get a token from \`POST /api/v1/auth/login\`.
      `,
      contact: { name: 'Tanmay Kaushik' },
    },
    servers,
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    tags: [
      { name: 'Auth',         description: 'Authentication and session management' },
      { name: 'Transactions', description: 'Financial record CRUD' },
      { name: 'Dashboard',    description: 'Analytics and summary endpoints' },
      { name: 'Users',        description: 'User management (admin only)' },
    ],
  },
  apis: ['./src/controllers/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);
module.exports = swaggerSpec;
