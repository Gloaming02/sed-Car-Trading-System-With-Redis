const { MongoClient, ObjectId} = require('mongodb');

const uri = 'mongodb://localhost:27017'; 

async function getCars() {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db('UsedCarSystem');
        const cars = await db.collection('users').aggregate([
            {
              $unwind: "$cars" 
            },
            {
              $project: {
                _id: 0, 
                car_id: "$cars._id",
                seller_id: "$_id", 
                make: "$cars.make",
                model: "$cars.model",
                year: "$cars.year",
                price: "$cars.price",
                mileage: "$cars.mileage",
                reportUrl: "$cars.reportUrl",
                location: "$cars.location"
              }
            }
          ]).limit(30).toArray();
        
        return cars;
    } catch (e) {
        console.error(e);
        throw e;
    } finally {
        await client.close();
    }
}

async function getCustomerByUsername(username) {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db('UsedCarSystem');
        const results = await db.collection('users').find({
            username: username,
            ssn: { $exists: false }
          }).toArray();
        console.log(username);
        return results;
    } catch (e) {
        console.error(e);
        throw e;
    } finally {
        await client.close();
    }
}

async function getSellerByUsername(username) {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db('UsedCarSystem');
        const results = await db.collection('users').find({
            username: username,
            ssn: { $exists: true }
          }).toArray();
        return results;
    } catch (e) {
        console.error(e);
        throw e;
    } finally {
        await client.close();
    }
}


async function insertUser(username, password, email, phone, userType, ssn) {

    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db('UsedCarSystem');
        //---------------
        console.log(username, password, email, phone, userType, ssn);
        let existingUser;
        if (userType === 'seller') {
            existingUser = await getSellerByUsername(username);
        } else {
            existingUser = await getCustomerByUsername(username);
        }
        console.log(existingUser);
        if (existingUser.length !== 0) {
            console.log('no');
            throw new Error('User already exists');
        }else{
            const userDocument = {
                username: username,
                password: password,
                email: email,
                phone: phone
            };
            if (userType === 'seller') {
                userDocument.ssn = ssn;
            }
            await db.collection('users').insertOne(userDocument);
            console.log('User inserted successfully');
        }
        //---------------

    } catch (e) {
        console.error(e);
        throw e;
    } finally {
        await client.close();
    }
  }

  async function insertCar(make, model, year, price, mileage, reportUrl, location, sellerId) {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db('UsedCarSystem');
        //---------------
        const carId = new ObjectId();
        const newCar = {
            _id: carId,
            make,
            model,
            year,
            price,
            mileage,
            reportUrl,
            location,
        };

        const result = await db.collection('users').updateOne(
            { "_id": new ObjectId(sellerId) },
            { $push: { "cars": newCar } }
        );

        if (result.modifiedCount === 0) {
            console.error('Failed to insert car into seller document');
            throw new Error('Failed to insert car into seller document');
        }

        console.log('Car inserted successfully:', newCar);
        //---------------

    } catch (e) {
        console.error(e);
        throw e;
    } finally {
        await client.close();
    }
  }

  async function getCarsById(sellerId) {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db('UsedCarSystem');
        //---------------
        const seller = await db.collection('users').findOne({ _id: new ObjectId(sellerId) });
        
        if (!seller) {
            throw new Error('Unexpected error');
        }
        

        const cars = seller.cars || [];
        for (const car of cars) {
            car.car_id = car._id;
            car.seller_id = sellerId;
        }

        console.log(cars);
        return cars;
        //---------------
    } catch (e) {
        console.error(e);
        throw e;
    } finally {
        await client.close();
    }
  }

  async function deleteCar(car_id) {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db('UsedCarSystem');
        //---------------
        const result = await db.collection('users').updateOne(
            { 'cars._id': new ObjectId(car_id) },
            { $pull: { cars: { _id: new ObjectId(car_id) } } }
          );
      
          if (result.matchedCount === 0) {
            console.log(`Car with id ${car_id} not found.`);
          } else {
            console.log(`Car with id ${car_id} deleted successfully.`);
          }
        //---------------
    } catch (e) {
        console.error(e);
        throw e;
    } finally {
        await client.close();
    }   
  }

  async function markCarInDatabase(customer_id, car_id) {
    console.log(customer_id);
    console.log(car_id);

    const db = await connect();
    const existingMark = await db.get('SELECT * FROM Mark WHERE customer_id = ? AND car_id = ?', [customer_id, car_id]);

    if (existingMark) {
      throw new Error('Mark for this car already exists.');
    }

    await db.run('INSERT INTO Mark (customer_id, car_id) VALUES (?, ?)', [customer_id, car_id]);
  }
  

async function removeMarkFromDatabase(customer_id, car_id) {
  const db = await connect();
  await db.run('DELETE FROM Mark WHERE customer_id = ? AND car_id = ?', [customer_id, car_id]);
}

async function getMarkedCarsByUser(userId) {
  const db = await connect();
  const markedCars = await db.all('SELECT * FROM Car INNER JOIN Mark ON Car.car_id = Mark.car_id WHERE Mark.customer_id = ?', [userId]);
  return markedCars;
}

async function searchCarsByCriteria(make, model, year, price, mileage, location, seller_id) {
    const db = await connect();
    let query = `SELECT * FROM Car WHERE 1=1`;
    const params = [];
  
    if (make) {
      query += ` AND make = ?`;
      params.push(make);
    }
  
    if (model) {
      query += ` AND model = ?`;
      params.push(model);
    }
  
    if (year) {
      query += ` AND year = ?`;
      params.push(year);
    }
  
    if (price) {
      query += ` AND price <= ?`;
      params.push(price);
    }
  
    if (mileage) {
      query += ` AND mileage <= ?`;
      params.push(mileage);
    }
  
    if (location) {
      query += ` AND location = ?`;
      params.push(location);
    }
  
    if (seller_id) {
      query += ` AND seller_id = ?`;
      params.push(seller_id);
    }
    console.log(query, params)
    const cars = await db.all(query, params);
  
    return cars;
  }

async function getAppointmentByUser(userId) {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db('UsedCarSystem');
        //---------------

        const existingAppointment = await db.collection("appointments").aggregate([
            {
              $match: { customer_id: new ObjectId(userId) }
            },
            {
              $lookup: {
                from: "users",
                localField: "car_id",
                foreignField: "cars._id",
                as: "userDetails"
              }
            },
            {
              $unwind: "$userDetails"
            },
            {
              $project: {
                _id: 1,
                sellerUsername: 1,
                customer_id: 1,
                seller_id: 1,
                date: 1,
                car_id: 1,
                carDetails: {
                  $filter: {
                    input: "$userDetails.cars",
                    as: "car",
                    cond: { $eq: ["$$car._id", "$car_id"] }
                  }
                }
              }
            },
            {
              $unwind: "$carDetails"
            },
            {
              $project: {
                _id: 1,
                customer_id: 1,
                sellerUsername: 1,
                date: 1,
                car_id: 1,
                make: "$carDetails.make",
                model: "$carDetails.model",
                year: "$carDetails.year",
                price: "$carDetails.price",
                mileage: "$carDetails.mileage",
                reportUrl: "$carDetails.reportUrl",
                location: "$carDetails.location"
              }
            }
          ]).toArray();
        return existingAppointment;

    } catch (e) {
        console.error(e);
        throw e;
    } finally {
        await client.close();
    }

}


async function makeAppointment(customer_id, seller_id, car_id, date) {

    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db('UsedCarSystem');
        //---------------
        const appointmentCollection = db.collection("appointments");

        const existingAppointment = await appointmentCollection.findOne({ car_id, date });
    
        if (existingAppointment) {
            console.log("This Car is not available at selected time");
            return;
        }
        
        const appointmentId = new ObjectId();
        const customerIdObject = new ObjectId(customer_id);
        const sellerIdObject = new ObjectId(seller_id);
        const carIdObject = new ObjectId(car_id);

        const result = await db.collection('users').findOne({ _id: new ObjectId(seller_id) });

        const newAppointment = {
            _id: appointmentId,
            customer_id: customerIdObject,
            seller_id: sellerIdObject,
            date: date,
            car_id: carIdObject,
            sellerUsername: result.username
        };

    
        await appointmentCollection.insertOne(newAppointment);
        console.log("Appointment successfully created.");

    } catch (e) {
        console.error(e);
        throw e;
    } finally {
        await client.close();
    }

}


module.exports = {
    getCars,
    getCustomerByUsername,
    getSellerByUsername,
    insertUser,
    insertCar,
    getCarsById,
    deleteCar,
    makeAppointment,
    searchCarsByCriteria,
    markCarInDatabase,
    removeMarkFromDatabase,
    getMarkedCarsByUser,
    getAppointmentByUser
};


