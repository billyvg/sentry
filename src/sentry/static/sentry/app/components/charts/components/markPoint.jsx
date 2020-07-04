/* global process */
import 'echarts/lib/component/markPoint';

/**
 * eCharts markPoint
 *
 * See https://ecomfe.github.io/echarts-doc/public/en/option.html#series-line.markPoint
 */
export default function MarkPoint(props) {
  return {
    animation: !process.env.IS_CI,
    ...props,
  };
}
