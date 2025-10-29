# generar_subgraph.py
import os
import sys
import json
from datetime import datetime
from ruamel.yaml import YAML # pip install ruamel.yaml

# Agrega 'backend' al path para que podamos importar 'utils.web3mongo'
script_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(os.path.dirname(script_dir)) 

sys.path.insert(0, backend_dir)

try:
    # Importamos tus propias definiciones de contratos
    from utils.web3mongo import CONTRACT_ADDRESSES, load_contract_abi, contracts
except ImportError as e:
    print(f"Error: No se pudo importar desde 'utils.web3mongo'. Asegúrate de que el path sea correcto.")
    print(f"Detalle: {e}")
    print(f"Buscando en: {backend_dir}")
    sys.exit(1)

# --- CONFIGURACIÓN ---
SUBGRAPH_NAME = "vanellix-ecosystem"
START_BLOCK = 26419000 # Tu INITIAL_BLOCK
NETWORK = "polygon-amoy" # <-- ARREGLO 1: Red correcta
SUBGRAPH_PROJECT_DIR = "./subgraph_vanellix" # Dónde crear el proyecto

# --- Lógica del Generador ---

def get_event_signature(event_abi):
    """Genera la firma de evento con tipos correctos (expande tuples) y 'indexed' en top-level cuando corresponda.
    Ej: PlatformTokenConfigured(indexed uint256,(uint256,uint256,string,string,uint256,string,string,address,bool))
    """

    def _resolve_type(param):
        t = param.get('type') or ''
        if t.startswith('tuple'):
            suffix = t[len('tuple'):]  # e.g. '', '[]', '[3]'
            comps = param.get('components', []) or []
            inner = ','.join(_resolve_type(c) for c in comps)
            return f"({inner}){suffix}"
        return t

    parts = []
    for inp in event_abi.get('inputs', []):
        typ = _resolve_type(inp)
        if inp.get('indexed', False):
            parts.append(f"indexed {typ}")
        else:
            parts.append(typ)
    return f"{event_abi['name']}({','.join(parts)})"

def generate_schema_graphql(all_events):
    """Genera el schema.graphql basado en todos los eventos de todos los ABIs."""
    schema_content = ""
    
    for event_name, event_info in all_events.items():
        schema_content += f'type {event_name} @entity {{\n'
        schema_content += f'  id: ID! # txHash-logIndex\n'
        schema_content += f'  contract: Bytes! # address del contrato\n'
        schema_content += f'  eventName: String!\n'
        
        # Parámetros del evento
        reserved = {"id", "contract", "eventName", "blockNumber", "blockTimestamp", "transactionHash"}
        used_names = set()
        for i, inp in enumerate(event_info['abi'].get('inputs', [])):
            sol_type = inp.get('type', '')
            # Omitimos arrays y tuples para evitar incompatibilidades en el schema
            if sol_type.startswith('tuple') or sol_type.endswith('[]'):
                continue

            raw_name = inp.get('name') or f"param{i}"
            param_name = raw_name
            if param_name in reserved or param_name == '':
                param_name = f"param_{raw_name or i}"
            while param_name in used_names or param_name == 'id':
                param_name = f"{param_name}_1"
            used_names.add(param_name)

            gql_type = "Bytes" # Default
            if sol_type.startswith('uint') or sol_type.startswith('int'):
                gql_type = "BigInt"
            elif sol_type == 'address':
                gql_type = "Bytes"
            elif sol_type == 'string':
                # dynamic types that are indexed are represented as Bytes in topics/codegen
                gql_type = "Bytes" if inp.get('indexed', False) else "String"
            elif sol_type == 'bool':
                gql_type = "Boolean"
            
            idx_str = " @index" if inp.get('indexed', False) else ""
            schema_content += f'  {param_name}: {gql_type}{idx_str}\n'

        # Metadatos del bloque
        schema_content += f'  blockNumber: BigInt! @index\n'
        schema_content += f'  blockTimestamp: BigInt! @index\n'
        schema_content += f'  transactionHash: Bytes!\n'
        schema_content += '}\n\n'
        
    return schema_content

def generate_subgraph_yaml(all_events):
    """Genera el subgraph.yaml"""
    yaml = YAML()
    yaml.preserve_quotes = True
    
    data_sources = []
    
    for contract_name, contract_instance in contracts.items():
        print(f"... Procesando contrato: {contract_name}")
        
        event_handlers = []
        contract_abi = contract_instance.abi # .abi es una lista
        
        for item in contract_abi:
            if item.get('type') == 'event':
                event_name = item['name']
                event_sig = get_event_signature(item)
                handler_name = f"handle{event_name}"
                
                event_handlers.append({'event': event_sig, 'handler': handler_name})
                
                if event_name not in all_events:
                     all_events[event_name] = {'abi': item, 'contracts': []}
                all_events[event_name]['contracts'].append(contract_name)

        # Si no hay eventos, omitimos este dataSource para evitar mappings vacíos
        if not event_handlers:
            print(f"WARN: {contract_name} no tiene eventos en el ABI; se omite dataSource")
            continue

        source_config = {
            'name': contract_name,
            'kind': 'ethereum/contract',
            'network': NETWORK,
            'source': {
                'address': contract_instance.address,
                'abi': contract_name,
                'startBlock': START_BLOCK
            },
            'mapping': {
                'kind': 'ethereum/events',
                'apiVersion': '0.0.7',
                'language': 'wasm/assemblyscript',
                'entities': sorted(list(set(item['name'] for item in contract_abi if item.get('type') == 'event'))),
                'abis': [{'name': contract_name, 'file': f'./abis/{contract_name}.json'}],
                'eventHandlers': event_handlers,
                'file': './src/mapping.ts'
            }
        }
        data_sources.append(source_config)

    subgraph_yaml = {
        'specVersion': '0.0.5',
        'schema': {'file': './schema.graphql'},
        'dataSources': data_sources
    }
    
    if "VanellixTokenFactory" in contracts:
        print("... Añadiendo Template para VanellixCompanyMultiToken (desde Factory)")
        
        template_name = "VanellixCompanyMultiTokenTemplate"
        template_contract_name = "VanellixCompanyMultiToken"
        
        template_handlers = []
        try:
            template_abi = load_contract_abi(template_contract_name) # Esto devuelve una lista
            template_entities = []
            
            for item in template_abi:
                if item.get('type') == 'event':
                    template_entities.append(item['name'])
                    template_handlers.append({
                        'event': get_event_signature(item),
                        'handler': f"handle{item['name']}"
                    })
            
            subgraph_yaml['templates'] = [
                {
                    'name': template_name,
                    'kind': 'ethereum/contract',
                    'network': NETWORK,
                    'source': {'abi': template_contract_name},
                    'mapping': {
                        'kind': 'ethereum/events',
                        'apiVersion': '0.0.7',
                        'language': 'wasm/assemblyscript',
                        'entities': sorted(list(set(template_entities))),
                        'abis': [{'name': template_contract_name, 'file': f'./abis/{template_contract_name}.json'}],
                        'eventHandlers': template_handlers,
                        'file': './src/mapping.ts'
                    }
                }
            ]
        except Exception as e:
            print(f"Error al crear template: {e}")

    return subgraph_yaml, all_events

def generate_mapping_ts(all_events):
    """Genera el src/mapping.ts con un handler para cada evento."""
    
    imports_set = set()
    handlers_content = ""
    
    entity_names = sorted(all_events.keys())
    imports_set.add(f"import {{ {', '.join(entity_names)} }} from '../generated/schema'")
    imports_set.add("import { BigInt } from '@graphprotocol/graph-ts'")
    
    contracts_events = {} 
    for event_name, event_info in all_events.items():
        for contract_name in event_info['contracts']:
            if contract_name not in contracts_events:
                contracts_events[contract_name] = []
            contracts_events[contract_name].append(event_name)
            
        if "VanellixCompanyMultiToken" not in contracts_events:
            contracts_events["VanellixCompanyMultiToken"] = []
            
    for contract_name, event_list in contracts_events.items():
         # Namespace import to avoid collisions when multiple contracts share event names
         imports_set.add(f"import * as {contract_name} from '../generated/{contract_name}/{contract_name}'")
         
    if "VanellixTokenFactory" in contracts:
        imports_set.add("import { VanellixCompanyMultiTokenTemplate } from '../generated/templates'")
        handlers_content += """
export function handleCompanyTokenCreated(event: VanellixTokenFactory.CompanyTokenCreated): void {
  VanellixCompanyMultiTokenTemplate.create(event.params.companyContract)
}
"""

    for event_name, event_info in all_events.items():
        # Evita duplicar el handler especial del template
        if event_name == 'CompanyTokenCreated':
            continue

        contract_source = event_info['contracts'][0]
        event_type = f"{contract_source}.{event_name}"
        handler_name = f"handle{event_name}"
        entity_name = event_name
        
        handlers_content += f'\nexport function {handler_name}(event: {event_type}): void {{\n'
        handlers_content += f'  let entity = new {entity_name}(event.transaction.hash.toHex() + "-" + event.logIndex.toString())\n\n'
        handlers_content += f'  entity.contract = event.address\n'
        handlers_content += f'  entity.eventName = "{event_name}"\n'
        
        let_used_names = set()
        for i, inp in enumerate(event_info['abi'].get('inputs', [])):
            sol_type = inp.get('type', '')
            # Saltar arrays y tuples
            if sol_type.startswith('tuple') or sol_type.endswith('[]'):
                continue

            raw_name = inp.get('name') or f"param{i}"
            out_name = raw_name
            if out_name in {"id", "contract", "eventName", "blockNumber", "blockTimestamp", "transactionHash"} or out_name == '':
                out_name = f"param_{raw_name or i}"
            while out_name in let_used_names or out_name == 'id':
                out_name = f"{out_name}_1"
            let_used_names.add(out_name)

            assign_expr = f"event.params.{raw_name}"
            if sol_type.startswith('uint') or sol_type.startswith('int'):
                # Si es un entero pequeño (<= 32 bits) codegen puede exponer i32; convertir a BigInt
                width = 256
                try:
                    width = int(sol_type[4:]) if sol_type.startswith('uint') else int(sol_type[3:])
                except Exception:
                    width = 256
                if width <= 32:
                    assign_expr = f"BigInt.fromI32(({assign_expr} as i32))"
            
            handlers_content += f'  entity.{out_name} = {assign_expr}\n'
            
        handlers_content += f'\n  entity.blockNumber = event.block.number\n'
        handlers_content += f'  entity.blockTimestamp = event.block.timestamp\n'
        handlers_content += f'  entity.transactionHash = event.transaction.hash\n'
        handlers_content += f'\n  entity.save()\n'
        handlers_content += '}\n'

    mapping_content = "\n".join(sorted(list(imports_set))) + "\n\n" + handlers_content
    return mapping_content

def main():
    print(f"--- Iniciando Generador de Subgraph para {SUBGRAPH_NAME} ---")
    
    project_dir = os.path.abspath(SUBGRAPH_PROJECT_DIR)
    abis_dir = os.path.join(project_dir, 'abis')
    src_dir = os.path.join(project_dir, 'src')
    
    os.makedirs(abis_dir, exist_ok=True)
    os.makedirs(src_dir, exist_ok=True)
    
    print(f"Directorio del proyecto: {project_dir}")

    # ==================================================================
    # ARREGLO 2: CÓMO SE COPIAN LOS ABIs
    # ==================================================================
    print("... Copiando ABIs ...")
    for contract_name in contracts.keys():
        try:
            # Tu 'load_contract_abi' (según web3mongo.py) devuelve la LISTA del ABI
            abi_list = load_contract_abi(contract_name)
            
            if not isinstance(abi_list, list):
                print(f"WARN: El ABI para {contract_name} no es una lista. Saltando.")
                continue
                
            dest_path = os.path.join(abis_dir, f"{contract_name}.json")
            with open(dest_path, 'w') as f:
                # Guardamos la lista del ABI directamente
                json.dump(abi_list, f, indent=2)
                
        except Exception as e:
            print(f"WARN: No se pudo cargar/copiar ABI para {contract_name}: {e}")
    # ==================================================================
    # FIN DEL ARREGLO
    # ==================================================================

    # 3. Generar subgraph.yaml
    all_events = {} 
    yaml_data, all_events = generate_subgraph_yaml(all_events)
    yaml_path = os.path.join(project_dir, 'subgraph.yaml')
    with open(yaml_path, 'w') as f:
        yaml = YAML()
        yaml.dump(yaml_data, f)
    print(f"OK: 'subgraph.yaml' generado con {len(yaml_data['dataSources'])} dataSources.")

    # 4. Generar schema.graphql
    schema_content = generate_schema_graphql(all_events)
    schema_path = os.path.join(project_dir, 'schema.graphql')
    with open(schema_path, 'w') as f:
        f.write(schema_content)
    print(f"OK: 'schema.graphql' generado con {len(all_events)} entidades.")

    # 5. Generar src/mapping.ts
    mapping_content = generate_mapping_ts(all_events)
    mapping_path = os.path.join(src_dir, 'mapping.ts')
    with open(mapping_path, 'w') as f:
        f.write(mapping_content)
    print(f"OK: 'src/mapping.ts' generado con {len(all_events)} handlers.")

    # 6. Crear package.json
    version_label = datetime.now().strftime('v%Y.%m.%d.%H%M')
    package_json = {
        "name": SUBGRAPH_NAME.replace('/', '-'),
        "version": "1.0.0",
        "scripts": {
            "codegen": "graph codegen",
            "build": "graph build",
            "deploy": f"graph deploy --studio {SUBGRAPH_NAME} --version-label {version_label}"
        },
        "dependencies": {
            "@graphprotocol/graph-cli": "0.62.0", 
            "@graphprotocol/graph-ts": "0.30.0"
        }
    }
    pkg_path = os.path.join(project_dir, 'package.json')
    with open(pkg_path, 'w') as f:
        json.dump(package_json, f, indent=2)
    print(f"OK: 'package.json' generado.")
    
    print("\n--- ¡Completado! ---")
    print(f"Proyecto de Subgraph generado en: {project_dir}")
    print("\nPróximos pasos:")
    print(f"1. cd {project_dir}")
    print(f"2. npm install (o yarn install)")
    print(f"3. npx graph auth --studio <TU_DEPLOY_KEY>")
    print(f"4. npm run codegen")
    print(f"5. npm run build")
    print(f"6. npm run deploy")

if __name__ == "__main__":
    main()