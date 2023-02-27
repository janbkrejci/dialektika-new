---
layout: default
title: Blog
permalink: /blog
paginator:
  paginate: enable
---

# Články


{% for post in paginator.posts %}
  {% capture i18n_date %}
  {% assign day = post.date | date: "%-d" %}
  {% assign m = post.date | date: "%-m" | minus: 1 %}
  {% assign month = site.months[m] %}
  {% assign year = post.date | date: "%Y" %}
  {% assign datum = day | append: ". " | append: month | append: " " | append: year %}
  {% assign author = "Anonym" %}
  {% if post.author %}
  {% assign author = post.author %}
  {% endif %}
  {% endcapture %}


<div class="card">
<h3 class="title">{{ post.title }}</h3>
<div class="date">{{ datum }}</div>
<div class="author">autor: {{ author }}</div>
<div class="perex">{{ post.excerpt }}</div>
<div class="more"><a href="{{ post.url }}">Číst dál...</a>
</div>

{% endfor %}


{% if paginator.total_pages > 1 %}
<ul>
  {% if paginator.previous_page %}
  <li>
    <a href="{{ paginator.previous_page_path | prepend: site.baseurl }}">Newer</a>
  </li>
  {% endif %}
  {% if paginator.next_page %}
  <li>
    <a href="{{ paginator.next_page_path | prepend: site.baseurl }}">Older</a>
  </li>
  {% endif %}
</ul>
{% endif %}