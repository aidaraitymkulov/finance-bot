import { FinanceScreen } from "./finance/FinanceScreen";
import { useColorScheme } from "./useColorScheme";

export const App = () => {
  const scheme = useColorScheme();
  return <FinanceScreen scheme={scheme} />;
};
