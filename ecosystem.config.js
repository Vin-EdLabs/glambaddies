/**
 * PM2 process file for GlamBaddies (https://www.glambaddies.com).
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 start ecosystem.config.js --env production
 */
module.exports = {
  apps: [
    {
      name: 'glambaddies',
      cwd: './backend',
      script: 'server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'development',
        PORT: 3100,
        APP_NAME: 'GlamBaddies',
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3100,
        APP_NAME: 'GlamBaddies',
        APP_URL: 'https://www.glambaddies.com',
        CLIENT_URL: 'https://www.glambaddies.com',
        FRONTEND_URL: 'https://www.glambaddies.com',
        BASE_URL: 'https://www.glambaddies.com',
      },
    },
  ],
};
