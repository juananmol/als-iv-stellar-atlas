# ALS IV · Stellar Atlas

Mapa local e interactivo de las 51.954 estrellas de la versión final del catálogo ALS IV.

La versión pública se despliega automáticamente con GitHub Pages cada vez que
se actualiza la rama `main`.

## Abrir el mapa

Desde esta carpeta:

```bash
npm run dev
```

Después abre `http://localhost:3000` en el navegador. Para detenerlo, pulsa `Ctrl+C` en la terminal.

## Publicar en GitHub Pages

El repositorio incluye el flujo de publicación en `.github/workflows/deploy-pages.yml`.
En GitHub, abre **Settings → Pages** y selecciona **GitHub Actions** en
**Build and deployment → Source**. Después, cada envío a `main` compilará y
publicará automáticamente el atlas.

## Actualizar los datos

El exportador busca en `../Data/catalouge/selected/` los archivos con nombre
`als_iv_FECHA_final.fits` y selecciona automáticamente la fecha numérica más reciente.
Para regenerar el archivo compacto que consume el navegador:

```bash
npm run catalog
```

Para exportar otra versión del catálogo:

```bash
npm run catalog -- --source ../Data/catalouge/selected/archivo.fits
```

## Proyección

- El mapa utiliza una proyección celeste 2D construida a partir de RA y Dec.
- Se representa el catálogo completo; la paralaje no interviene en la posición ni en la selección.
- Arrastra para desplazarte y usa la rueda para ampliar o reducir la vista.
