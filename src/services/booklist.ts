import { Request, Response } from 'express';
import Logger from '../util/logger';
import { getBooksByStatus } from '../db/books';
import { error, success } from '../util/response';
import Status from '../db/model/status';

const fetchList = async (req: Request, res: Response, username: string, status: Status) => {
  try {
    const books = await getBooksByStatus(username, status);
    res.status(200).json(success(books));
  } catch (err) {
    Logger.error(err);
    res.send(422).json(error([{ code: 'book_list_error', message: 'Couldnt find books' }]));
  }
};

const getCompletedList = (req: Request, res: Response) => fetchList(req, res, res.locals.username, 'completed');
const getReadingList = (req: Request, res: Response) => fetchList(req, res, res.locals.username, 'reading');
const getOnHoldList = (req: Request, res: Response) => fetchList(req, res, res.locals.username, 'on-hold');
const getDroppedList = (req: Request, res: Response) => fetchList(req, res, res.locals.username, 'dropped');
const getPlannedList = (req: Request, res: Response) => fetchList(req, res, res.locals.username, 'planned');

export {
  getCompletedList,
  getReadingList,
  getOnHoldList,
  getDroppedList,
  getPlannedList,
};
