// Handle uncaught exception
process.on('uncaughtException', err => {
  console.log(err.name, err.message);
  console.log('UNHANDLE EXCEPTION! 💥 Shutting down...');
  // Exit de process with an unhandle rejection (0 ok 1 unhandle)
  process.exit(1);
});

const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: './config.env' });

const app = require('./app');

const DB = process.env.DATABASE.replace(
  '<PASSWORD>',
  process.env.DATABASE_PASSWORD
);

mongoose
  .connect(DB, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: false,
    useUnifiedTopology: true
  })
  .then(() => console.log('DB connection successful!'));

const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
  console.log(`App running on port ${port}....`);
});

// Global unhandle promise rejection
process.on('unhandledRejection', err => {
  console.log(err.name, err.message);
  console.log('UNHANDLE REJECTION! 💥 Shutting down...');
  // Exit de process with an unhandle rejection (0 ok 1 unhandle)
  server.close(() => {
    process.exit(1);
  });
});

process.on('SIGTERM', () => {
  console.log('👌 SIGTERM RECEIVED. Shutting down gracefully 👌');
  server.close(() => {
    console.log('💥 Process terminated!');
  });
});
