import 'server-only';
import {existsSync,readFileSync} from 'node:fs';
import {parseEnv} from 'node:util';

export function operatorDetails(){
  const configured:Record<string,string>={};
  for(const file of ['.env','/var/www/naydi-data/runtime.env']){
    if(existsSync(file))Object.assign(configured,parseEnv(readFileSync(file,'utf8')));
  }
  const values={...configured,...process.env};
  return {
    status:values.NAYDI_LEGAL_STATUS?.trim()||'',
    name:values.NAYDI_LEGAL_NAME?.trim()||'',
    inn:values.NAYDI_LEGAL_INN?.trim()||'',
    ogrn:values.NAYDI_LEGAL_OGRN?.trim()||'',
    address:values.NAYDI_LEGAL_ADDRESS?.trim()||'',
    email:values.NAYDI_LEGAL_EMAIL?.trim()||'',
    phone:values.NAYDI_LEGAL_PHONE?.trim()||'',
  };
}
