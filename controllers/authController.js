const crypto = require('crypto');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const User = require('../model/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Email = require('../utils/email');

const signToken = id => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  });
};

const createSendToken = (user, statusCode, req, res) => {
  const token = signToken(user._id);

  // COOKIE
  // sending cookie
  res.cookie('jwt', token, {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    // send the cookie only in https protocol
    // secure: true,
    // cookie can only be accessed and modified in http
    httpOnly: true,
    // If in production, then set secure to true, so that it only works in https
    secure: req.secure || req.headers['x-forwarded-proto'] === 'https'
  });

  // this is made so that when we send the response with the data of the user, the password is not sent too
  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user
    }
  });
};

exports.signup = catchAsync(async (req, res, next) => {
  // With this, only the data that we need is being passed to the database
  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
    photo: req.body.photo,
    passwordChangedAt: req.body.passwordChangedAt,
    cpfNumber: req.body.cpfNumber,
    phoneNumber: req.body.phoneNumber,
    birthday: req.body.birthday,
    state: req.body.state,
    city: req.body.city,
    neighborhood: req.body.neighborhood,
    street: req.body.street,
    number: req.body.number,
    zipcode: req.body.zipcode,
    role: req.body.role
  });

  const emailToken = await newUser.createCheckEmailToken();

  // Email to verify the account
  try {
    await new Email(newUser, emailToken).sendEmailCheck();
  } catch (err) {
    newUser.checkEmailToken = undefined;
    newUser.createTempPasswords = undefined;
    await newUser.save({ validateBeforeSave: false });

    return next(
      new AppError(
        'There was an error sending the email. Try again later.',
        503
      )
    );
  }
  res.status(200).json({
    status: 'success',
    message: 'Email of authentication sent!',
    data: {
      user: newUser
    }
  });
});

// To login we send the token, if only there is a email and the password match,

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // 1) Check if email and password exist
  if (!email || !password) {
    return next(new AppError('Please provide email and password', 400));
  }

  // 2) Check if user exists && password is correct
  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    return next(new AppError('Incorrect email or password', 401));
  }

  // Verifica se email e senha estão corretos
  if (!(await user.correctPassword(password, user.password))) {
    return next(new AppError('Incorrect email or password', 401));
  }
  // Limit number of login attempts for the same email

  const dateNowNoMinSecMili = new Date().setMinutes(0, 0, 0);

  // Se estiver na primeira tentativa, então armazena o tempo que iniciou a primeira tentativa
  if (user.loginAttempts === 0) {
    user.dateLoginAttempt = dateNowNoMinSecMili;
  }

  // Reseta o número de tentativas depois de 1h
  if (dateNowNoMinSecMili > user.dateLoginAttempt) {
    user.dateLoginAttempt = undefined;
    user.loginAttempts = 0;
  } else if (
    !dateNowNoMinSecMili ||
    dateNowNoMinSecMili === user.dateLoginAttempt.getTime()
  ) {
    // Incrementa o número de tentativas
    user.loginAttempts += 1;
  }

  // Verifica se atingiu o número máximo de tentativas
  if (user.loginAttempts > process.env.NUMBER_LOGIN_ATTEMPTS) {
    return next(
      new AppError('Too many login attempts. Try again in an hour.', 401)
    );
  }

  await user.save({ validateBeforeSave: false });

  // Verifica se email está autenticado
  if (!user.emailVerified && user.checkEmailExpire > Date.now()) {
    res.status(200).json({
      status: 'success',
      message: 'checking email'
    });
    next();
  }

  // Verifica se email de autenticação já expirou
  if (!user.emailVerified === true && user.checkEmailExpire < Date.now()) {
    const emailToken = await user.createTempPassword();
    // Email to verify the account
    try {
      await new Email(user, emailToken).sendEmailCheck();
      console.log('email sent');
    } catch (err) {
      user.checkEmailToken = undefined;
      user.checkEmailExpire = undefined;
      await user.save({ validateBeforeSave: false });
    }
    return next(
      new AppError(
        'Your email code has expired. No problem, we sent another email to you. Remember that you have 10min.',
        401
      )
    );
  }

  // 3) If everything ok, then send token to client
  createSendToken(user, 200, req, res);
});

exports.logout = (req, res) => {
  res.cookie('jwt', 'loggedout', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true
  });
  res.status(200).json({
    status: 'success'
  });
};

// Middleware to verify if the user is logged in
exports.protect = catchAsync(async (req, res, next) => {
  // 1) Getting token and check if exist
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  // Check if token exist
  if (!token) {
    return next(
      new AppError('You are not logged in! please log in to get access.', 401)
    );
  }

  // 2) Verification token
  // Verify if someone has alterated the database
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
  console.log(process.env.JWT_SECRET);
  console.log({ decoded });
  console.log({ token });

  // decode => id (payload), iat (created at), exp (expire at)

  // 3) Check if user still exists
  const currentUser = await User.findById(decoded.id);
  if (!currentUser) return next(new AppError('User no longer exist!', 401));

  // 4) Check if user changed password after the token was issued
  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError('User recently changed password. Please login again!', 401)
    );
  }

  // GRANT ACESS TO PROTECTED ROUTE

  // If no problem, them go to the route
  res.locals.user = currentUser;
  req.user = currentUser;
  next();
});

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    // roles ['admin', 'lead-guide']
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action', 403)
      );
    }
    next();
  };
};

exports.forgotPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on POSTed email
  const user = await User.findOne({ email: req.body.email });
  if (!user)
    return next(new AppError('There is no user with that email address!', 404));

  // 2) Generate the random reset token
  const resetToken = await user.createPasswordResetToken();

  // 3) Send it to user's email

  try {
    await new Email(user, resetToken).sendPasswordReset();
    res.status(200).json({
      status: 'success',
      message: 'Temp password sent to email!'
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(
      new AppError(
        'There was an error sending the email. Try again later!',
        503
      )
    );
  }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on the token
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpire: { $gt: Date.now() }
  });

  // 2) If token has not expired, and there is user, set the new password
  if (!user) {
    return next(new AppError('Token is invalid or has expired', 400));
  }

  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpire = undefined;
  await user.save();

  // 3) Update changedPasswordAt property for the user
  // Done at a pre middlewwate

  // 4) Log the user in, send JWT
  createSendToken(user, 200, req, res);

  next();
});

exports.updateMyPassword = catchAsync(async (req, res, next) => {
  // 1) Get user from collection
  // Cannot use findByIdAndUpdate because no middleware at userModel will work update
  // Do not use anything as update when changing the password
  const user = await User.findById(req.user.id).select('+password');

  // 2) Check if POSTed current password is correct
  if (!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
    return next(new AppError('Your current password is wrong!', 401));
  }

  // 3) If so, update password
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  await user.save({ validateBeforeSave: false });

  // 4) Log user in, send JWT
  createSendToken(user, 200, req, res);
});

exports.checkEmail = catchAsync(async (req, res, next) => {
  // Hash the token received to be equal to that stored at the database of the user
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  // Find the user using the hashed token that was received
  const user = await User.findOne({ checkEmailToken: hashedToken });

  // Verify if the user exists
  if (!user) {
    return next(new AppError('Incorret token provided!', 401));
  }

  // Verify if the user is already authenticated
  if (user.emailVerified === true) {
    return res.status(401).json({
      message: 'This account is already verified!'
    });
  }

  // Verify if the token has expired
  if (user.checkEmailExpire < new Date()) {
    return next(new AppError('Your token has expired!', 401));
  }

  // Update the emailVerified'
  user.emailVerified = true;
  await user.save({ validateBeforeSave: false });

  createSendToken(user, 200, req, res);
});

// Only for rendered pages, no errors!
exports.isLoggedIn = async (req, res, next) => {
  // 1) verify token

  if (req.cookies.jwt) {
    try {
      const decoded = await promisify(jwt.verify)(
        req.cookies.jwt,
        process.env.JWT_SECRET
      );

      // 2) Check if user still exists
      const currentUser = await User.findById(decoded.id);
      if (!currentUser) return next();

      // 4) Check if user changed password after the token was issued
      if (currentUser.changedPasswordAfter(decoded.iat)) {
        return next();
      }

      // THERE IS A LOGGED IN USER
      // PUG templates have access to res.locals.___
      res.locals.user = currentUser;
      return next();
    } catch (err) {
      return next();
    }
  }
  next();
};
