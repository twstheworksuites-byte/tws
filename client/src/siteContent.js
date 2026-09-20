import { useEffect, useState } from 'react';
import { api } from './api';

export function useSiteContent(key,fallback){const[value,setValue]=useState(fallback);useEffect(()=>{let active=true;api(`/content/${key}`).then(result=>{if(active&&result.item)setValue({title:result.item.title,body:result.item.body})}).catch(()=>{});return()=>{active=false}},[key]);return value}
