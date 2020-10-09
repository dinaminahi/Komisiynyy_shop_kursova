const express = require('express');
const bodeParser = require('body-parser');
const ejs = require('ejs');
const _ = require('lodash');
const mongoose = require('mongoose');
const multer = require('multer');
const fs = require('fs');
const mongoXlsx = require('mongo-xlsx');

const app = express();

const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, './uploads/');
  },
  filename: function(req, file, cb){
    cb(null, file.originalname);
  }
});

const fileFilter = (req, file, cb) => {
   if(file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
     cb(null, true);
   } else {
     cb(null, false);
   }
}

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 1024 * 1024 * 5
  },
  fileFilter: fileFilter
});

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
app.use(bodeParser.urlencoded({
  extended: true
}));
// ///////////////////////////////////////////////////////////////// database
mongoose.connect('mongodb://localhost:27017/komisiynyiDB');

const productSchema = {
  name: String,
  description: String,
  price: Number,
  photo: {type: String, required: true}
};

const clientSchema = {
  name: String,
  phone: String,
  email: String,
  password: String
};

const orderSchema = {
   clientName: String,
   phone: String,
   totalSum: String,
   orderDate: String,
   products: [productSchema]
}

const Product = mongoose.model('Product', productSchema);
const Client = mongoose.model('Client', clientSchema);
const Order = mongoose.model('Order', orderSchema);
///////////////////////////////////////////////////////////////////////////

app.get('/', function(req, res) {
  Product.find({}, function(err, products) {
    res.render('main', {
      products: products
    });
  });
});

app.get('/sortHigher', function(req, res) {
  Product.find({}, function(err, products) {
    res.render('main', {
      products: products.sort((a,b) => a.price - b.price)
    });
  });
});

app.get('/sortLower', function(req, res) {
  Product.find({}, function(err, products) {
    res.render('main', {
      products: products.sort((a,b) => b.price - a.price)
    });
  });
});


app.get('/products/:productId', function(req, res) {
  const requestedProductId = req.params.productId;
  Product.findOne({
    _id: requestedProductId
  }, function(err, product) {
    res.render('product', {
      title: product.name,
      description: product.description,
      price: product.price,
      photo: product.photo
    });
  });
});

let shoppingCartItems = [];

app.get('/order/:productId', function(req, res) {
    const requestedProductId = req.params.productId;
    Product.findOne({
      _id: requestedProductId
    }, function(err, product) {
       shoppingCartItems.push(product);
       res.redirect('/');
    });
});

app.get('/shopping-cart', function(req, res) {
   res.render('shopping-cart', {shoppingCartItems: shoppingCartItems});
});


app.post('/order', function(req, res) {
   const order = new Order({
      clientName: req.body.name,
      phone: req.body.phone,
      totalSum: shoppingCartItems.reduce((acc, currItem) => acc.price + currItem.price),
      orderDate: new Date().toGMTString().substring(5,25),
      products: shoppingCartItems
   });
   order.save(function(err) {
     if (!err) {
       Order.find({})
        .then((doc)=>{
          fs.appendFile('orders.docx', '['+ doc.length +']' + 'ПІБ: ' + doc[doc.length-1].clientName +
           ' Номер телефону: ' + doc[doc.length-1].phone +
            ' Сума замовлення: ' + doc[doc.length-1].totalSum +
            ' Дата замовлення: ' + doc[doc.length-1].orderDate +
            ' Товари: ' + doc[doc.length-1].products.map(product => product.name) + '\n\n', function (err) {
            if (err) throw err;
            console.log('Saved!');
          });
        });
       res.redirect('/');
     } else {
       res.redirect('/failure');
     }
   });
});

app.get('/add', function(req, res) {
  res.render('add');
});


app.post('/add', upload.single('photo'), function(req, res) {
  const product = new Product({
    name: req.body.name,
    price: Number(req.body.price),
    description: req.body.description,
    photo: req.file.path
  });
  product.save(function(err) {
    if (!err) {
      res.redirect("/");
    }
  });
});


app.get('/registry', function(req, res) {
  res.render('registry');
});


app.post('/registry', function(req, res) {

  const client = new Client({
    name: req.body.name,
    phone: req.body.phone,
    email: req.body.email,
    password: req.body.password
  });
  client.save(function(err) {
    if (!err) {
      res.redirect('/');
    } else {
      res.redirect('/failure');
    }
  });
});


app.get('/authorization', function(req, res) {
  res.render('authorization');
});

app.post('/authorization', function(req, res){

  Client.find({email: req.body.email, password: req.body.password})
   .then((doc)=>{
      if(doc.length){
        res.redirect('/add');
      } else {
        res.redirect('/failure');
      }
   });
});

app.get('/failure',function(req, res){
   res.render('failure');
});

const adminEmail = 'diankagrechukh@gmail.com';
const adminPassword = 'dianadiana';


app.get('/admin', function(req,res) {
    res.render('welcomeAdmin');
});

app.post('/adminAuthorization', function(req, res) {
   if((req.body.email).toLowerCase() === adminEmail && req.body.password === adminPassword){
     Product.find({}, function(err, products) {
       res.render('adminPage', {
         products: products
       });
     });
   }
});

app.get('/deleteProduct/:productId', function(req, res) {
  const requestedProductId = req.params.productId;
  Product.deleteOne({_id: requestedProductId}, function(err){
    if(err){
      console.log(err);
    }else{
      Product.find({}, function(err, products) {
        res.render('adminPage', {
          products: products
        });
      });
    }
  });
});

// Order.find({}, function(err, order){
//    const model = mongoXlsx.buildDynamicModel(order);
//    mongoXlsx.mongoData2Xlsx(order, model, function(err, order) {
//      console.log('File saved at:', order.fullPath);
//    });
// });

// Order.find({})
//  .then((doc)=>{
//    for(let i = 0; i < doc.length; i++){
//    fs.appendFile('orders.docx', '['+ i +']' + 'ПІБ: ' + doc[i].clientName +  ' Номер телефону: ' + doc[i].phone + ' Сума замовлення: ' + doc[i].totalSum + ' Дата замовлення: ' + doc[i].orderDate +  ' Товари: ' + doc[i].products.map(product => product.name) + '\n\n', function (err) {
//      if (err) throw err;
//      console.log('Saved!');
//    });
//  }
//  });

// Order.find({})
//    .then((doc)=>{
//      console.log(doc);
//    });

// Product.deleteOne({name: 'Светр' }, function(err){
//   if(err){
//     console.log(err);
//   }else{
//     console.log('Deleted');
//   }
// });

app.listen(3000, () => console.log('Server started on port 3000!'));
