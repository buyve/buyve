module.exports = {
  apps: [
    {
      name: 'socket-server',
      script: 'server/index.ts',
      interpreter: 'node',
      interpreter_args: '--loader ts-node/esm',
      instances: 'max', // CPU 코어 수만큼 인스턴스 생성
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        REDIS_URL: 'redis://localhost:6379'
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3001,
        REDIS_URL: 'redis://localhost:6379'
      },
      // 🎯 성능 최적화 설정
      max_memory_restart: '500M',
      node_args: '--max-old-space-size=512',
      
      // 📊 로그 관리
      log_file: 'logs/combined.log',
      out_file: 'logs/out.log',
      error_file: 'logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // 🔄 자동 재시작 설정
      watch: false,
      ignore_watch: ['node_modules', 'logs'],
      
      // 🚀 클러스터 설정
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 3000
    }
  ]
}; 