const express = require('express');

const {
  getAllUsers,
  getUser,
  deleteUser,
  updateUser,
  updateMe,
  deleteMe,
  getMe,
  uploadUserPhoto,
  resizeUserPhoto,
  getUserByToken,
  getMyTours
} = require('../controllers/userController');

const {
  protect,
  signup,
  login,
  forgotPassword,
  resetPassword,
  updateMyPassword,
  checkEmail,
  restrictTo,
  logout
} = require('../controllers/authController');

const router = express.Router();

router.post('/signup', signup);
router.post('/signupPhoto', uploadUserPhoto, resizeUserPhoto, updateMe);
router.post('/login', login);
router.post('/forgotPassword', forgotPassword);

router.get('/logout', logout);
router.get('/getUserByToken', protect, getUserByToken);

router.patch('/resetPassword/:token', resetPassword);
router.patch('/checkEmail/:token', checkEmail);

router.use(protect);

router.patch('/updateMyPassword', updateMyPassword);
router.patch('/updateMe', uploadUserPhoto, resizeUserPhoto, updateMe);

router.get('/me', getMe, getUser);
router.get('/myTours', getMyTours);

router.delete('/deleteMe', deleteMe);

router.use(restrictTo('admin'));

router.route('/').get(getAllUsers);

router
  .route('/:id')
  .get(getUser)
  .delete(deleteUser)
  .patch(updateUser);

module.exports = router;
