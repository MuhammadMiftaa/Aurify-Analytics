import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';
import YAML from 'yaml';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load OpenAPI specification
const openApiPath = path.join(__dirname, '../../openapi.yaml');
const openApiFile = fs.readFileSync(openApiPath, 'utf8');
const swaggerDocument = YAML.parse(openApiFile);

// Swagger UI options
const swaggerOptions = {
  customCss: `
    .swagger-ui .topbar { display: none }
    .swagger-ui .info { margin: 50px 0 }
    .swagger-ui .info .title { font-size: 36px }
  `,
  customSiteTitle: 'Refina Analytics API Documentation',
  customfavIcon: '/favicon.ico',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    syntaxHighlight: {
      activate: true,
      theme: 'monokai'
    },
    tryItOutEnabled: true,
  }
};

/**
 * Setup Swagger UI for API documentation
 * @param app Express application instance
 */
export function setupSwagger(app: Express): void {
  // Serve Swagger UI
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerDocument, swaggerOptions)
  );

  // Serve raw OpenAPI JSON
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerDocument);
  });

  // Serve raw OpenAPI YAML
  app.get('/api-docs.yaml', (req, res) => {
    res.setHeader('Content-Type', 'text/yaml');
    res.send(openApiFile);
  });

  console.log('📚 API Documentation available at: /api-docs');
  console.log('📄 OpenAPI JSON available at: /api-docs.json');
  console.log('📄 OpenAPI YAML available at: /api-docs.yaml');
}

export default setupSwagger;
