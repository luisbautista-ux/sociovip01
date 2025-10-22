
#!/usr/bin/env python3
# src/scripts/consulta_dni.py

import sys
import json
import re
import time
import os
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import sparticuz

def clean_value(s: str) -> str:
    if not s:
        return ""
    s = str(s).strip()
    # Elimina etiquetas como "Nombres:", "Apellido Paterno:", etc.
    s = re.sub(r'(?i)(nombres?|apellidos?|apellido\s*(paterno|materno)?)\s*:\s*', '', s)
    s = s.replace("\n", " ").strip()
    return s

def parse_fields_from_text(text):
    out = {"dni": None, "nombres": None, "apellido_paterno": None, "apellido_materno": None, "fecha_nacimiento": None}
    if not text:
        return out
    
    text = re.sub(r'\r', '\n', text)

    # Nombres y Apellidos (método más robusto)
    name_match = re.search(r'Datos\s*de\s*la\s*Persona:\s*([^\n]+)', text, re.IGNORECASE)
    if name_match:
        full_name_raw = clean_value(name_match.group(1))
        # Asumir que los dos primeros son nombres y los dos últimos apellidos
        parts = full_name_raw.split()
        if len(parts) >= 3:
            out["nombres"] = " ".join(parts[:-2])
            out["apellido_paterno"] = parts[-2]
            out["apellido_materno"] = parts[-1]
        elif len(parts) == 2:
            out["nombres"] = parts[0]
            out["apellido_paterno"] = parts[1]
    else: # Fallback a los patrones individuales si el principal falla
        m_nombres = re.search(r'Nombres:\s*([^\n]+)', text, re.IGNORECASE)
        if m_nombres: out["nombres"] = clean_value(m_nombres.group(1))
        m_paterno = re.search(r'Apellido Paterno:\s*([^\n]+)', text, re.IGNORECASE)
        if m_paterno: out["apellido_paterno"] = clean_value(m_paterno.group(1))
        m_materno = re.search(r'Apellido Materno:\s*([^\n]+)', text, re.IGNORECASE)
        if m_materno: out["apellido_materno"] = clean_value(m_materno.group(1))

    # Fecha de nacimiento
    m_fecha = re.search(r'(\d{2}/\d{2}/\d{4})', text)
    if m_fecha:
        out["fecha_nacimiento"] = m_fecha.group(1).strip()
        
    return out

def consulta_dni_selenium(dni):
    chrome_opts = Options()
    chrome_opts.add_argument("--headless=new")
    chrome_opts.add_argument("--no-sandbox")
    chrome_opts.add_argument("--disable-dev-shm-usage")
    chrome_opts.add_argument("--disable-gpu")
    chrome_opts.add_argument("--single-process")
    chrome_opts.add_argument(f"--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36")
    chrome_opts.page_load_strategy = 'eager'

    # Set binary location for sparticuz/chromium
    chrome_opts.binary_location = sparticuz.chromium_path
    
    driver = None
    try:
        driver = webdriver.Chrome(options=chrome_opts)
        driver.get("https://dniperu.com/buscar-dni-nombres-apellidos/")
        
        # Usar esperas explícitas para mayor estabilidad
        input_box = WebDriverWait(driver, 10).until(
            EC.visibility_of_element_located((By.NAME, "dni4"))
        )
        input_box.send_keys(dni)

        button = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.XPATH, "//button[contains(text(), 'Buscar')]"))
        )
        driver.execute_script("arguments[0].click();", button)

        # Esperar el contenedor de resultados
        result_div = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CLASS_NAME, "info-dni"))
        )
        
        # A veces la página necesita un momento extra para renderizar el texto
        time.sleep(1) 
        
        result_text = result_div.text
        parsed_data = parse_fields_from_text(result_text)
        
        return parsed_data

    except Exception as e:
        # En caso de error, no imprimimos nada para que la salida JSON no se corrompa
        return {"error": str(e)}
    finally:
        if driver:
            driver.quit()

if __name__ == "__main__":
    if len(sys.argv) > 1:
        dni_a_consultar = sys.argv[1]
        resultado = consulta_dni_selenium(dni_a_consultar)
        # La única salida del script debe ser el JSON del resultado
        print(json.dumps(resultado, ensure_ascii=False))
    else:
        # Si no se provee DNI, devolver un JSON de error
        print(json.dumps({"error": "No DNI provided"}), file=sys.stderr)
        sys.exit(1)
