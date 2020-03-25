const express = require('express');
const {
  getCheckoutSession,
  getBooking,
  getAllBooking,
  updateBooking,
  deleteBooking,
  createBooking
} = require('../controllers/bookingController');
const { protect, restrictTo } = require('../controllers/authController');

const router = express.Router();
router.use(protect);

router.get('/checkout-session/:tourId', getCheckoutSession);

router.use(restrictTo('admin', 'lead-guide'));

router
  .route('/:id')
  .get(getBooking)
  .patch(updateBooking)
  .delete(deleteBooking);

router
  .route('/')
  .get(getAllBooking)
  .post(createBooking);

module.exports = router;
