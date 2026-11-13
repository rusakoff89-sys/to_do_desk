#!/usr/bin/env python3
"""Локальный сервер доски задач.

Отдаёт файлы проекта как обычный http.server, но на адреса страниц доски
возвращает index.html, чтобы прямые ссылки открывались:
  /board        доска
  /list         список
  /task/42      карточка задачи
  /employees    сотрудники
  /help         справка (этот README)
Любые другие несуществующие пути без расширения тоже ведут на index.html.

Запуск:  python3 server.py        (порт 8000)
         python3 server.py 8080   (другой порт)
"""
import http.server, os, re, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
PAGES = re.compile(r'^/(board|list|employees|help|task/\d+)/?$')


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def send_head(self):
        path = self.path.split('?', 1)[0].split('#', 1)[0]
        local = self.translate_path(path)
        # Нет такого файла и это не запрос к файлу с расширением — отдаём index.html
        if PAGES.match(path) or (not os.path.exists(local) and '.' not in os.path.basename(path)):
            self.path = '/index.html'
        return super().send_head()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()


if __name__ == '__main__':
    http.server.ThreadingHTTPServer.allow_reuse_address = True
    with http.server.ThreadingHTTPServer(('', PORT), Handler) as srv:
        print(f'Доска задач: http://localhost:{PORT}  (остановить: Ctrl+C)')
        srv.serve_forever()
