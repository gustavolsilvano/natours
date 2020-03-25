const pagarme = require('pagarme');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Tour = require('../model/tourModel');

exports.checkCard = catchAsync(async (req, res, next) => {
  const { cardNumber, cardName, cardCvv, cardExpiration } = req.body;
  const card = {
    card_holder_name: cardName,
    card_expiration_date: cardExpiration,
    card_number: cardNumber,
    card_cvv: cardCvv
  };
  const cardValidation = pagarme.validate({ card });

  if (!cardValidation.card.card_number) {
    return next(new AppError('Cartão com número incorreto', 401));
  }

  const client = await pagarme.client.connect({
    encryption_key: process.env.PAGARME_API_ENCRYPT
  });

  const cardHash = await client.security.encrypt(card);

  req.card = cardHash;
  next();
});

exports.buyTour = catchAsync(async (req, res, next) => {
  const { user } = req;
  const { tourId } = req.params;
  const tour = await Tour.findById(tourId);
  req.tour = tour;
  const { card } = req;
  const client = await pagarme.client.connect({
    api_key: process.env.PAGARME_API
  });

  const response = await client.transactions.create({
    amount: tour.price * 100,
    card_hash: card,
    customer: {
      external_id: user._id,
      name: user.name,
      type: 'individual',
      country: 'br',
      email: user.email,
      documents: [
        {
          type: 'cpf',
          // Documento para recusar por antifraude
          //   number: '11111111111'
          number: user.cpfNumber.toString()
        }
      ],
      phone_numbers: [user.phoneNumber.toString()],
      birthday: user.birthday.toString()
    },
    billing: {
      name: user.name,
      address: {
        country: 'br',
        state: user.state.toString(),
        city: user.city.toString(),
        neighborhood: user.neighborhood.toString(),
        street: user.street.toString(),
        street_number: user.number.toString(),
        zipcode: user.zipcode.toString()
      }
    },
    items: [
      {
        id: tour._id,
        title: tour.name,
        unit_price: tour.price * 100,
        quantity: 1,
        tangible: false
      }
    ],
    soft_descriptor: 'Natour'
  });

  if (response.status === 'refused')
    return next(
      new AppError(`Transação recusada: ${response.refuse_reason}`, 401)
    );
  req.transaction = response;
  next();
});
