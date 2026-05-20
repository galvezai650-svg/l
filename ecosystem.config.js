module.exports = {
  apps: [
    {
      name: 'page-viewer',
      script: 'bun',
      args: 'run dev',
      cwd: '/home/z/my-project',
      env: {
        PORT: 3000,
        NODE_ENV: 'development',
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      listen_timeout: 10000,
      kill_timeout: 5000,
    },
  ],
};
