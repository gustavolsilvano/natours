const express = require('express');
const tourController = require('../controllers/tourController');
const { protect, restrictTo } = require('../controllers/authController');

const {
  getAllTours,
  createTour,
  getTour,
  updateTour,
  deleteTour,
  aliasTopTours,
  getTourStats,
  getMonthlyPlan,
  deleteDelete,
  getToursWithin,
  getDistances,
  uploadTourImages,
  resizeTourImages
} = tourController;

const reviewRouter = require('../routes/reviewRoutes');

const router = express.Router();

router.use('/:tourId/reviews', reviewRouter);

router.route('/tour-stats').get(getTourStats);
router
  .route('/monthly-plan/:year')
  .get(protect, restrictTo('admin', 'lead-guide', 'user'), getMonthlyPlan);

router.route('/top-5-cheap').get(aliasTopTours, getAllTours);

// /tours-distance?distance=233&center=-40,45&unit=mi
// /tour-distance?233/center/-40,45/unit/mi - standard to specify this way
router
  .route('/tours-whitin/:distance/center/:latlng/unit/:unit')
  .get(getToursWithin);

// Distance from the center to the tour
router.route('/distances/:latlng/unit/:unit').get(getDistances);

router
  .route('/')
  .get(getAllTours)
  .post(protect, restrictTo('admin', 'lead-guide'), createTour)
  .delete(protect, deleteDelete);

router
  .route('/:id')
  .get(getTour)
  .patch(
    protect,
    restrictTo('admin', 'lead-guide'),
    uploadTourImages,
    resizeTourImages,
    updateTour
  )
  .delete(protect, restrictTo('admin', 'lead-guide'), deleteTour);

module.exports = router;
