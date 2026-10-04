import { useEffect, useState } from 'react';
import { api } from './api';
import { useApp } from './context';

export function useSiteContent(key,fallback){const[value,setValue]=useState(fallback),{operationsVersion}=useApp();useEffect(()=>{let active=true;api(`/content/${key}`).then(result=>{if(active)setValue(result.item?{title:result.item.title,body:result.item.body}:fallback)}).catch(()=>{});return()=>{active=false}},[key,operationsVersion]);return value}
