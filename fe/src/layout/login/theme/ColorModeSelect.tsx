import {useColorScheme} from '@mui/material/styles';
import MenuItem from '@mui/material/MenuItem';
import Select, {type SelectProps} from '@mui/material/Select';
import { useTranslation } from 'react-i18next';

export default function ColorModeSelect(props: SelectProps) {
  const {mode, setMode} = useColorScheme();
  const {t} = useTranslation();
  if (!mode) {
    return null;
  }
  return (
    <Select
      value={mode}
      onChange={(event) => setMode(event.target.value as 'system' | 'light' | 'dark')}
      SelectDisplayProps={{
        // @ts-expect-error Ignore this error for data attributes
        'data-screenshot': 'toggle-mode',
      }}
      {...props}
    >
      <MenuItem value="system">{t('app.themes.system')}</MenuItem>
      <MenuItem value="light">{t('app.themes.light')}</MenuItem>
      <MenuItem value="dark">{t('app.themes.dark')}</MenuItem>
    </Select>
  );
}
