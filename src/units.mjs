export const MM_PER_INCH = 25.4;
export const lengthKeys = ['width','shaft','clearance','flangeThickness','flangeOverhang','extensionLength','extensionDiameter','coneLength','coneBase','coneTip','grooveWidth','grooveDepth'];
export const toDisplay = (mm, unit) => unit === 'in' ? mm / MM_PER_INCH : mm;
export const toModel = (value, unit) => unit === 'in' ? value * MM_PER_INCH : value;
export const displayValue = (mm, unit) => Number.isFinite(mm) ? Number(toDisplay(mm, unit).toFixed(unit === 'in' ? 5 : 4)) : '';
export const formatLength = (mm, unit) => Number.isFinite(mm) ? `${toDisplay(mm, unit).toFixed(unit === 'in' ? 4 : 2)} ${unit}` : '—';
export const parametersForDisplay = (p, unit) => Object.fromEntries(Object.entries(p).map(([key,value]) => [key,lengthKeys.includes(key) ? toDisplay(value,unit) : value]));
export const parametersForModel = (p, unit) => Object.fromEntries(Object.entries(p).map(([key,value]) => [key,lengthKeys.includes(key) ? toModel(value,unit) : value]));
