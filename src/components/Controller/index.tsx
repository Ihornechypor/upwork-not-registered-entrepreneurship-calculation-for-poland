import { ReactNode, useState, useEffect } from 'react';
import { getCurrecyRate } from '../../api/getCurrecyRate';
import 'react-datepicker/dist/react-datepicker.css';
import { format, subDays, parse } from 'date-fns';
import Papa from 'papaparse';

interface ControllerProps {
  children?: ReactNode;
}

const updateSubDays = (date: string, day: number) => subDays(parse(date, 'MMM d, yyyy', new Date()), day);

const formatedDate = (date: string) => format(date, 'yyyy-MM-dd');

const calculateLocalAmounts = (amount: number, rate: number, type: string) => {
  let amountFee = +(amount * 0.1).toFixed(2);
  const amountLocal = +(amount * rate).toFixed(2);
  let amountFeeLocal = -Math.abs(+(amountLocal * 0.1).toFixed(2));
  let amountFeeVat = -Math.abs(+(amountFeeLocal * 0.23).toFixed(2));
  if (type === 'Withdrawal Fee') {
    amountFee = 0;
    amountFeeLocal = 0;
    amountFeeVat = 0;
  }
  if (type === 'Membership Fee') {
    amountFee = 0;
    amountFeeVat = 0;
    amountFeeLocal = +(amountLocal * 0.23).toFixed(2);
  }
  return {
    amountFee,
    amountLocal,
    amountFeeLocal,
    amountFeeVat,
  };
};

const Controller = ({ children }: ControllerProps) => {
  const [hasMounted, setHasMounted] = useState(false);
  const [rate, setRate] = useState([]);
  const [apiData, setApiData] = useState([]);
  const [totalData, setTotalData] = useState({
    amountOfIncum: 0,
    amountOfCosts: 0,
    amountOfCostsWithVat: 0,
    ammountOfFeeOfVat: 0,
    ammoutClear: 0,
    ammoutClearAndVat: 0,
  });
  // csv
  const [csvData, setCsvData] = useState();

  const fetchData = async (formatedDate: string) => {
    let currentDate = formatedDate;
    const retryCount = 0;
    while (retryCount < 6) {
      try {
        const data = await getCurrecyRate(currentDate, formatedDate);
        if (data && data.formatedDate) {
          setApiData((prev) => [...prev, data]);
          break;
        } else {
          console.error('Empty or invalid API response');
        }
      } catch (error) {
        const subDay = subDays(parse(currentDate, 'yyyy-MM-dd', new Date()), 1);

        currentDate = format(subDay, 'yyyy-MM-dd');
        retryCount + 1;
      }
    }
  };

  const handleDate = (date: any) => {
    const prevDate = updateSubDays(date, 1);
    fetchData(formatedDate(prevDate));

    return formatedDate(prevDate);
  };

  useEffect(() => {
    if (hasMounted) {
      const onlyPayments = rate.filter(
        (item) => item.type === 'Fixed Price' || item.type === 'Hourly' || item.type === 'Bonus',
      );

      const ifAditionalCosts = rate
        .filter((item) => item.type === 'Membership Fee' || item.type === 'Withdrawal Fee')
        .reduce((acc, currentValue) => acc + currentValue.amountLocal, 0);

      console.log(ifAditionalCosts);

      const amountOfIncum = onlyPayments.reduce((acc, currentValue) => acc + currentValue.amountLocal, 0);
      const amountOfCosts = rate.reduce((acc, currentValue) => acc + currentValue.amountFeeLocal, 0) + ifAditionalCosts;
      const amountOfCostsWithVat = rate.reduce(
        (acc, currentValue) => acc + currentValue.amountFeeLocal + currentValue.amountFeeVat,
        0 + ifAditionalCosts,
      );

      const ammountOfFeeOfVat = rate.reduce((acc, currentValue) => acc + currentValue.amountFeeVat, 0);

      const ammoutClear = amountOfIncum + amountOfCosts;
      const ammoutClearAndVat = amountOfIncum + amountOfCostsWithVat;

      setTotalData({
        amountOfIncum,
        amountOfCosts,
        amountOfCostsWithVat,
        ammountOfFeeOfVat,
        ammoutClear,
        ammoutClearAndVat,
      });
    } else {
      setHasMounted(true);
    }
  }, [rate]);

  useEffect(() => {
    if (hasMounted) {
      if (apiData.length === rate.length) {
        const sortedByDays = apiData.sort(
          (a, b) => parse(b.formatedDate, 'yyyy-MM-dd', new Date()) - parse(a.formatedDate, 'yyyy-MM-dd', new Date()),
        );
        const compairedArray = rate.map((item, index) => {
          return {
            ...item,
            ...sortedByDays[index],
            ...calculateLocalAmounts(item.amount, sortedByDays[index].currecyRate, item.type),
          };
        });

        setRate(compairedArray);
      }
    } else {
      setHasMounted(true);
    }
  }, [apiData]);

  const handleReset = () => {
    setRate([]);
    setApiData([]);
    console.clear();
  };

  const handleCsvInputChange = (e) => {
    setCsvData(e.target.value);
  };

  const parseCSVToArray = () => {
    try {
      Papa.parse(csvData, {
        complete: (result) => {
          const flArr = result.data.filter(
            (item) =>
              item.Type === 'Fixed Price' ||
              item.Type === 'Hourly' ||
              item.Type === 'Bonus' ||
              item.Type === 'Membership Fee' ||
              item.Type === 'Withdrawal Fee',
          );

          const filteredArray = flArr.map((obj) => ({
            initialDate: obj.Date,
            type: obj.Type,
            description: obj.Description,
            formatedDate: handleDate(obj.Date),
            amount: Number(obj.Amount),
          }));

          setRate(filteredArray);
        },
        header: true,
      });
    } catch (error) {
      console.error('Error parsing CSV:', error);
    }
  };

  return (
    <>
      <p>
        Currensy: <br />
      </p>
      <br />
      <textarea value={csvData} onChange={handleCsvInputChange} placeholder="Paste CSV data here" rows={5} cols={50} />
      <br />
      <button onClick={parseCSVToArray}>Load csv</button>
      <button onClick={handleReset}>Reset List</button>
      <table>
        <tbody>
          <tr>
            <th>CSV Date:</th>
            <th>Description:</th>
            <th>Formated Date:</th>
            <th>Currecy Date:</th>
            <th>Currecy Rate:</th>
            <th>Amount in USD:</th>
            <th>Amount fee in USD:</th>
            <th>Amount in PLN:</th>
            <th>Amount Fee in PLN:</th>
            <th>Amount Fee VAT in PLN:</th>
          </tr>
          {rate.map((item, index) => (
            <tr key={index}>
              <td>{item.initialDate}</td>
              <td style={{ width: 200 }}>{item.description}</td>
              <td>{item.formatedDate}</td>
              <td>{item.currecyDate}</td>
              <td>{item.currecyRate}</td>
              <td>{item.amount}</td>
              <td>{item.amountFee}</td>
              <td>{item.amountLocal}</td>
              <td>{item.amountFeeLocal}</td>
              <td>{item.amountFeeVat}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div>
        <p>
          <b>Total Incum</b>: {totalData.amountOfIncum}
        </p>
        <p>
          <b>Total Costs</b>: {totalData.amountOfCosts}
        </p>
        <p>
          <b>Total Costs with Vat</b>: {totalData.amountOfCostsWithVat}
        </p>
        <p>
          <b>Total Vat 23%</b>: {totalData.ammountOfFeeOfVat}
        </p>
        <p>
          <b>Total to spend</b>: {totalData.ammoutClear}
        </p>
        <p>
          <b>Total to spend and Vat</b>: {totalData.ammoutClearAndVat}
        </p>
      </div>
    </>
  );
};
export default Controller;
