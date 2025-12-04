import mysql from 'mysql2/promise';
import { 
  mysql_address,
  mysql_database,
  mysql_password,
  mysql_port,
  mysql_user
  } from '$env/static/private';

export function initializeDatabase() {
  let pool = mysql.createPool({
    host: mysql_address,
    user: mysql_user,
    password: mysql_password,
    database: mysql_database,
    port: Number(mysql_port),
    connectionLimit: 5,
    waitForConnections: true,
  });

  return pool;
}