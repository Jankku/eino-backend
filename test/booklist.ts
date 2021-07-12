/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable import/no-extraneous-dependencies */
import chai from 'chai';
import chaiHttp from 'chai-http';
import app from '../src/app';

const should = chai.should();

chai.use(chaiHttp);

describe('Booklist', () => {
  it('Should insert book', (done) => {
    const book = {
      isbn: '1827481928572',
      title: 'Test book',
      author: 'Test Author',
      publisher: 'Publisher',
      pages: 1234,
      status: 'reading',
      score: 0,
    };

    chai.request(app)
      .post('/api/books/')
      .set('Authorization', `Bearer ${process.env.JWT_TEST_TOKEN}`)
      .send(book)
      .end((err, res) => {
        res.should.have.status(201);
        res.body.should.be.a('object');
        res.body.should.have.property('result');
        res.body.result.should.be.a('object');
        res.body.result.should.have.property('code').eql('book_added_to_list');
        res.body.result.should.have.property('message').eql('Book added to list');
        done();
      });
  });

  it('Should return reading list', (done) => {
    chai.request(app)
      .get('/api/books/reading')
      .set('Authorization', `Bearer ${process.env.JWT_TEST_TOKEN}`)
      .end((err, res) => {
        res.should.have.status(200);
        res.body.should.be.a('object');
        res.body.should.have.property('result');
        res.body.result.should.be.a('array');
        res.body.result[0].should.be.a('object');
        res.body.result[0].should.have.property('book_id');
        res.body.result[0].should.have.property('username');
        res.body.result[0].should.have.property('status');
        res.body.result[0].should.have.property('score');
        done();
      });
  });
});
