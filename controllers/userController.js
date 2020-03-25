const sharp = require('sharp');
const multer = require('multer');
const catchAsync = require('../utils/catchAsync');
const User = require('../model/userModel');
const Booking = require('../model/bookingModel');
const Tour = require('../model/tourModel');
const AppError = require('../utils/appError');
const factory = require('./handlerFactory');
// const multerStorage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, 'public/img/users');
//   },
//   filename: (req, file, cb) => {
//     //user-{userid}-{currentTImeStamp}.jpeg
//     const ext = file.mimetype.split('/')[1];
//     cb(null, `user-${req.user.id}-${Date.now()}.${ext}`);
//   }
// });
const multerStorage = multer.memoryStorage();

// test if uploaded file is an image, ture to image false to not
const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(new AppError('Not an image! Please upload only images.', 400), false);
  }
};

const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter
});

exports.uploadUserPhoto = upload.single('photo');

exports.resizeUserPhoto = catchAsync(async (req, res, next) => {
  if (!req.file) return next();
  if (req.headers.user && !req.user) {
    req.user = {};
    req.user.id = req.headers.user;
  }

  req.file.filename = `user-${req.user.id}-${Date.now()}.jpeg`;
  await sharp(req.file.buffer)
    .resize(500, 500)
    .toFormat('jpeg')
    .jpeg({ quality: 90 })
    .toFile(`public/img/users/${req.file.filename}`);

  next();
});

const filterObj = (obj, ...allowedFields) => {
  const newObj = {};
  Object.keys(obj).forEach(el => {
    if (allowedFields.includes(el)) {
      newObj[el] = obj[el];
    }
  });
  return newObj;
};

exports.updateMe = catchAsync(async (req, res, next) => {
  // 1) Create error if user POSTs password data
  if (req.body.password || req.body.passwordConfirm) {
    return next(
      new AppError(
        'This route is not for password updates! Please use /updatePassword',
        400
      )
    );
  }

  // 2) Filtered out unwanted fields that are not allowed to be updatedUser
  const filteredBody = filterObj(req.body, 'name', 'email', 'photo');
  if (req.file) filteredBody.photo = req.file.filename;

  // 3) Update user document
  // There are some fields that are required and using user.save() will
  // necessary need this fields to be filled. Like password and passwordConfirm

  // we do not pass req.body right away because this away the user can change the
  //role and other fields that are special.
  const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
    // new: true Return the new updated user and not the old one
    new: true,

    // catch any invalid property likes invalid email
    runValidators: true
  });

  res.status(200).json({
    status: 'success',
    data: {
      user: updatedUser
    }
  });
});

exports.getMe = (req, res, next) => {
  req.params.id = req.user.id;
  next();
};

exports.deleteMe = catchAsync(async (req, res, next) => {
  await User.findByIdAndUpdate(req.user.id, { active: false });
  res.status(204).json({
    status: 'success',
    data: null
  });
});

exports.getUserByToken = catchAsync(async (req, res) => {
  if (!req.user) return new AppError('Invalid Token', 401);
  res.status(200).json({
    status: 'success',
    data: {
      user: req.user
    }
  });
});

exports.getMyTours = catchAsync(async (req, res) => {
  // virtual populate
  // 1) Find all bookings
  const bookings = await Booking.find({ user: req.user.id });
  // 2) Find tours with the returned IDs
  const tourIDs = bookings.map(el => el.tour);
  const tours = await Tour.find({ _id: { $in: tourIDs } });

  res.status(200).json({
    status: 'success',
    data: {
      tours
    }
  });
});

exports.deleteUser = factory.deleteOne(User);
exports.updateUser = factory.updateOne(User);
exports.getAllUsers = factory.getAll(User);
exports.getUser = factory.getOne(User);
