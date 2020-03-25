const crypto = require('crypto');
const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please tell us your name!'],
    maxlength: [32, 'User name must be at max 20 characters'],
    minlength: [10, 'User name must be at minimum 10 characters']
  },
  email: {
    type: String,
    required: [true, 'Please provide your email!'],
    unique: [true, 'There is an account with this email already!'],
    trim: true,
    lowercase: true,
    validate: [validator.isEmail, 'Please provide a valid email!']
  },
  photo: {
    type: String,
    default: 'default.jpg'
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'guide', 'lead-guide'],
    default: 'user'
  },
  password: {
    type: String,
    required: [true, 'Please provide a password!'],
    minlength: [8, 'Please provide a password with at minimum 8 characters!'],
    select: false
  },
  passwordConfirm: {
    type: String,
    required: [true, 'Please confirm your password!'],
    validate: {
      // This only works on CREATE and SAVE!!!!!!
      validator: function(el) {
        return el === this.password;
      },
      message: 'Password must be equal!'
    }
    //   select: false
  },
  passwordChangedAt: Date,
  passwordResetToken: String,
  passwordResetExpire: Date,
  active: {
    type: Boolean,
    default: true,
    select: false
  },
  loginAttempts: {
    type: Number,
    default: 0
    // select: false
  },
  dateLoginAttempt: {
    type: Date
    // select: false
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  checkEmailToken: String,
  checkEmailExpire: Date,
  cpfNumber: {
    type: String,
    minlength: [11, 'CPF must be of 11 characters'],
    maxlength: [11, 'CPF must be of 11 characters'],
    required: [true, 'Please provide your CPF number']
  },
  phoneNumber: {
    type: [String],
    minlength: [14, 'Check your phone number'],
    maxlength: [14, 'Check your phone number'],
    required: [true, 'Please provide your phone number']
  },
  birthday: {
    type: String,
    minlength: [10, 'Birthday must be of 10 characters'],
    maxlength: [10, 'Birthday must be of 10 characters'],
    required: [true, 'Please provide your birthday']
  },
  state: {
    type: String,
    required: [true, 'Please provide the state that you are living']
  },
  city: {
    type: String,
    required: [true, 'Please provide the city that you are living']
  },
  neighborhood: {
    type: String,
    required: [true, 'Please provide the neighborhood of your adress']
  },
  street: {
    type: String,
    required: [true, 'Please provide the street of your adress']
  },
  number: {
    type: String,
    required: [true, 'Please provide the number of your adress']
  },
  zipcode: {
    type: String,
    required: [true, 'Please provide the zipcode of your adress']
  }
});

userSchema.pre('save', async function(next) {
  //
  // Verify with only the password has been modified
  if (!this.isModified('password')) return next();

  // Hash the password with cost of 12
  this.password = await bcrypt.hash(this.password, 12);

  // delete the passwordConfirm from the database
  this.passwordConfirm = undefined;

  next();
});

// Change passwordChangedAt whenever we have a change in password
userSchema.pre('save', function(next) {
  // verify if the password has NOT changed or if it's a new document
  if (!this.isModified('password') || this.isNew) return next();

  // Modified password changed at, and add a delay of 1second due to the fact that the JWT can be slower to
  // create, and the JWT need to have a timestamp greater than passwordChangedAt
  this.passwordChangedAt = Date.now() - 1000;
  next();
});

userSchema.pre(/^find/, async function(next) {
  // this points to the current querry
  this.find({ active: { $ne: false } });
  next();
});

userSchema.methods.correctPassword = function(candidatePassword, userPassword) {
  // Compare if the password are equal, the encrypted one and the user password.
  // userPassword -> hashed ; candidatePassword -> the one that the user pass
  return bcrypt.compare(candidatePassword, userPassword);
};

userSchema.methods.changedPasswordAfter = function(JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimeStamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );
    // Return true if we changed the password after the token was sent.
    return JWTTimestamp < changedTimeStamp;
  }
  // False means not changed
  return false;
};

userSchema.methods.createPasswordResetToken = async function() {
  const tempPassword = crypto.randomBytes(3).toString('hex');
  this.password = tempPassword;
  this.passwordResetExpire = Date.now() + 10 * 60 * 1000;
  await this.save({ validateBeforeSave: false });

  return tempPassword;
};

userSchema.methods.createCheckEmailToken = async function() {
  const checkEmailToken = crypto.randomBytes(3).toString('hex');

  this.checkEmailToken = crypto
    .createHash('sha256')
    .update(checkEmailToken)
    .digest('hex');

  this.checkEmailExpire = Date.now() + 10 * 60 * 1000;
  // console.log({ checkEmailToken }, this.checkEmailToken);

  await this.save({ validateBeforeSave: false });
  return checkEmailToken;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
