// Bootstrap: run vite from scale_9.4 root on port 5180
process.chdir('E:/scale_9.4');
process.argv = [process.argv[0], process.argv[1], '--port', '5180', '--strictPort'];
await import('file:///E:/scale_9.4/node_modules/vite/bin/vite.js');
