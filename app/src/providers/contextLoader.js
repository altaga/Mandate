import AsyncStorage from "@react-native-async-storage/async-storage";
import { Fragment, useCallback, useContext, useEffect } from "react";
import { getAsyncStorageValue } from "../utilsApp/utils";
import ContextModule from "./contextModule";

export default function ContextLoader() {
  const { value, setValue } = useContext(ContextModule);
  const checkStarter = useCallback(async () => {
    if (value && value.starter) {
      return;
    }
    try {
      const nonSensitiveData = await getAsyncStorageValue("NONSENSITIVEDATA");

      if (nonSensitiveData === null) {
        setValue({ starter: true });
        return;
      }

      const schema = await AsyncStorage.getItem("General");
      if (!schema) {
        setValue({
          ...value,
          starter: true,
        });
        return;
      }

      setValue({
        nonSensitiveData,
        starter: true,
      });
    } catch (error) {
      setValue({
        ...value,
        starter: true,
      });
    }
  }, [setValue, value]);

  useEffect(() => {
    checkStarter();
  }, [checkStarter]);

  return <Fragment />;
}
