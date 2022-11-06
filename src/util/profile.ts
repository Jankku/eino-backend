import DbBook from '../db/model/dbbook';
import DbMovie from '../db/model/dbmovie';
import { ItemScore } from '../services/profile';

/**
 * Fills array gaps so that there are ItemScore objects which have score
 * from 0 to 10. Lastly it sorts the array by the score property.
 * @example
 * [
 *    { score: 0, count: 6 },
 *    { score: 1, count: 4 },
 *    { score: 2, count: 1 },
 *    { score: 3, count: 12 }
 *    ...
 * ]
 * @param array Initial book/movie score array
 */
const fillAndSortResponse = async (array: ItemScore[]) =>
  new Promise<Array<ItemScore>>((resolve) => {
    const resultArray: ItemScore[] = [];
    const foundNumbers: number[] = [];

    array.forEach((item) => {
      resultArray.push(item);
      foundNumbers.push(item.score);
    });

    for (let i = 0; i <= 10; i++) {
      if (!foundNumbers.includes(i)) {
        resultArray.push({ score: i, count: '0' });
      }
    }

    resultArray.sort((a, b) => a.score - b.score);
    resolve(resultArray);
  });

const getTruncatedTitles = (list: DbBook[] | DbMovie[]) =>
  list.map(({ title }) => (title.length > 25 ? `${title.slice(0, 22)}...` : title));

export { fillAndSortResponse, getTruncatedTitles };
