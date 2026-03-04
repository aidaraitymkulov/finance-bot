module.exports = {
  apps: [
    {
      name: 'finance-bot',
      script: 'dist/main.js',
      instances: 1,
      autorestart: true,
      restart_delay: 5000,
      kill_timeout: 5000,
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};
