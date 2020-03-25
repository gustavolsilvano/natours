const express = require('express');
const reviewController = require('../controllers/reviewController');
const authController = require('../controllers/authController');

const {
  getAllReview,
  createReview,
  deleteReview,
  updateReview,
  setTourUserIds,
  getReview
} = reviewController;
const { protect, restrictTo } = authController;

// mergeParams each router only has acess to params of their route
// with mergeParams we get the param of routes that are before this one

const router = express.Router({ mergeParams: true });

router.use(protect);

router
  .route('/')
  .get(restrictTo('user'), getAllReview)
  .post(restrictTo('user'), setTourUserIds, createReview);

router.route('/:userIDReview').get(restrictTo('user'), getAllReview);

router
  .route('/:id')
  .delete(restrictTo('user', 'admin'), deleteReview)
  .patch(restrictTo('user', 'admin'), updateReview)
  .get(getReview);

module.exports = router;
