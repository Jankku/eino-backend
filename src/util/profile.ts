import { ItemScoreRow } from '../db/profile';

/**
 * Fills array gaps so that there are ItemScoreRow objects which have score
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
const fillAndSortResponse = async (array: ItemScoreRow[]) =>
  new Promise<Array<ItemScoreRow>>((resolve) => {
    const resultArray: ItemScoreRow[] = [];
    const foundNumbers: number[] = [];

    for (const item of array) {
      resultArray.push(item);
      foundNumbers.push(item.score);
    }

    for (let i = 0; i <= 10; i++) {
      if (!foundNumbers.includes(i)) {
        resultArray.push({ score: i, count: 0 });
      }
    }

    resultArray.sort((a, b) => a.score - b.score);
    resolve(resultArray);
  });

export { fillAndSortResponse };
